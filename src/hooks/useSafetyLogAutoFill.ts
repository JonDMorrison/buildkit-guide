import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

interface WeatherData {
  temp: number;
  condition: string;
  description: string;
}

interface YesterdayLog {
  weather: string;
  crew_count: string;
  hazards_identified: string;
  ppe_compliance: string;
  incidents: string;
  corrective_actions: string;
}

export interface HazardSuggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: 'weather' | 'task' | 'trade' | 'history' | 'general';
}

export interface PPERequirement {
  id: string;
  trade_type: string;
  ppe_item: string;
  is_mandatory: boolean;
  description: string | null;
}

interface AutoFillData {
  weather: WeatherData | null;
  crewCount: number | null;
  yesterdayLog: YesterdayLog | null;
  hazardSuggestions: HazardSuggestion[];
  ppeRequirements: PPERequirement[];
  tradesOnSite: string[];
}

// Weather condition mapping from Open-Meteo codes
const getConditionFromCode = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 56 && code <= 57) return 'Freezing Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 66 && code <= 67) return 'Freezing Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
};

export function useSafetyLogAutoFill(projectId: string | null) {
  const [loading, setLoading] = useState(false);
  const [hazardsLoading, setHazardsLoading] = useState(false);
  const [data, setData] = useState<AutoFillData>({
    weather: null,
    crewCount: null,
    yesterdayLog: null,
    hazardSuggestions: [],
    ppeRequirements: [],
    tradesOnSite: [],
  });

  const fetchWeather = useCallback(async (): Promise<WeatherData | null> => {
    if (!projectId) return null;

    try {
      // First try to get job site location for the project
      const { data: jobSite } = await supabase
        .from('job_sites')
        .select('latitude, longitude')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(1)
        .single();

      let lat = jobSite?.latitude;
      let lon = jobSite?.longitude;

      // If no job site, try to get user's current location
      if (!lat || !lon) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false,
            });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;
        } catch {
          // Default to Vancouver if no location available
          lat = 49.2827;
          lon = -123.1207;
        }
      }

      // Fetch weather from Open-Meteo
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius`
      );

      if (!response.ok) throw new Error('Weather fetch failed');

      const weatherData = await response.json();
      const temp = Math.round(weatherData.current.temperature_2m);
      const condition = getConditionFromCode(weatherData.current.weather_code);
      const windSpeed = Math.round(weatherData.current.wind_speed_10m);

      return {
        temp,
        condition,
        description: `${temp}°C, ${condition}${windSpeed > 20 ? `, Wind ${windSpeed} km/h` : ''}`,
      };
    } catch (error) {
      console.error('Error fetching weather:', error);
      return null;
    }
  }, [projectId]);

  const fetchCrewCount = useCallback(async (): Promise<number | null> => {
    if (!projectId) return null;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Count unique users who checked in today for this project
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select('user_id')
        .eq('project_id', projectId)
        .gte('check_in_at', `${today}T00:00:00`)
        .lte('check_in_at', `${today}T23:59:59`);

      if (error) throw error;

      // Get unique user count
      const uniqueUsers = new Set(entries?.map(e => e.user_id) || []);
      return uniqueUsers.size > 0 ? uniqueUsers.size : null;
    } catch (error) {
      console.error('Error fetching crew count:', error);
      return null;
    }
  }, [projectId]);

  const fetchYesterdayLog = useCallback(async (): Promise<YesterdayLog | null> => {
    if (!projectId) return null;

    try {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Find yesterday's daily safety log
      const { data: form, error: formError } = await supabase
        .from('safety_forms')
        .select('id')
        .eq('project_id', projectId)
        .eq('form_type', 'daily_safety_log')
        .eq('inspection_date', yesterday)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (formError || !form) return null;

      // Get the entries for that form
      const { data: entries, error: entriesError } = await supabase
        .from('safety_entries')
        .select('field_name, field_value')
        .eq('safety_form_id', form.id);

      if (entriesError || !entries) return null;

      // Build the log object
      const log: YesterdayLog = {
        weather: '',
        crew_count: '',
        hazards_identified: '',
        ppe_compliance: '',
        incidents: '',
        corrective_actions: '',
      };

      entries.forEach(entry => {
        if (entry.field_name in log) {
          log[entry.field_name as keyof YesterdayLog] = entry.field_value || '';
        }
      });

      return log;
    } catch (error) {
      console.error('Error fetching yesterday log:', error);
      return null;
    }
  }, [projectId]);

  const fetchPPERequirements = useCallback(async (): Promise<PPERequirement[]> => {
    try {
      const { data, error } = await supabase
        .from('trade_ppe_requirements')
        .select('*')
        .order('trade_type')
        .order('is_mandatory', { ascending: false })
        .order('ppe_item');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching PPE requirements:', error);
      return [];
    }
  }, []);

  const fetchTradesOnSite = useCallback(async (): Promise<string[]> => {
    if (!projectId) return [];

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Step 1: Get unique user_ids who checked in today
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('user_id')
        .eq('project_id', projectId)
        .gte('check_in_at', `${today}T00:00:00`)
        .lte('check_in_at', `${today}T23:59:59`);

      if (timeError) {
        console.error('Error fetching time entries:', timeError);
        return [];
      }

      if (!timeEntries || timeEntries.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = [...new Set(timeEntries.map(e => e.user_id))];
      
      // Step 2: Get project members with those user IDs and their trades
      const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select('trade_id, trades(name, trade_type)')
        .eq('project_id', projectId)
        .in('user_id', userIds)
        .not('trade_id', 'is', null);

      if (membersError) {
        console.error('Error fetching project members:', membersError);
        return [];
      }

      // Extract unique trade types
      const tradeTypes = new Set<string>();
      members?.forEach((member: any) => {
        if (member.trades?.trade_type) {
          tradeTypes.add(member.trades.trade_type);
        }
      });

      return Array.from(tradeTypes);
    } catch (error) {
      console.error('Error fetching trades on site:', error);
      return [];
    }
  }, [projectId]);

  const fetchHazardSuggestions = useCallback(async (weatherDescription?: string): Promise<HazardSuggestion[]> => {
    if (!projectId) return [];

    setHazardsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('ai-safety-suggest', {
        body: {
          project_id: projectId,
          weather_conditions: weatherDescription,
          date: format(new Date(), 'yyyy-MM-dd'),
        },
      });

      if (error) throw error;
      return result?.suggestions || [];
    } catch (error) {
      console.error('Error fetching hazard suggestions:', error);
      return [];
    } finally {
      setHazardsLoading(false);
    }
  }, [projectId]);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [weather, crewCount, yesterdayLog, ppeRequirements, tradesOnSite] = await Promise.all([
        fetchWeather(),
        fetchCrewCount(),
        fetchYesterdayLog(),
        fetchPPERequirements(),
        fetchTradesOnSite(),
      ]);

      setData(prev => ({ ...prev, weather, crewCount, yesterdayLog, ppeRequirements, tradesOnSite }));

      // Fetch hazard suggestions with weather context (runs separately for better UX)
      const hazardSuggestions = await fetchHazardSuggestions(weather?.description);
      setData(prev => ({ ...prev, hazardSuggestions }));
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchWeather, fetchCrewCount, fetchYesterdayLog, fetchPPERequirements, fetchTradesOnSite, fetchHazardSuggestions]);

  return {
    ...data,
    loading,
    hazardsLoading,
    fetchAll,
    fetchWeather,
    fetchCrewCount,
    fetchYesterdayLog,
    fetchPPERequirements,
    fetchTradesOnSite,
    fetchHazardSuggestions,
  };
}
