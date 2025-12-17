import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WeatherData {
  temp: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'windy';
  description: string;
}

interface WeatherBadgeProps {
  latitude?: number;
  longitude?: number;
}

// Simple weather condition mapping based on weather codes
const getConditionFromCode = (code: number): WeatherData['condition'] => {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
};

const WeatherIcon = ({ condition, className }: { condition: WeatherData['condition']; className?: string }) => {
  switch (condition) {
    case 'clear':
      return <Sun className={className} />;
    case 'rain':
      return <CloudRain className={className} />;
    case 'snow':
      return <CloudSnow className={className} />;
    case 'storm':
      return <CloudLightning className={className} />;
    case 'windy':
      return <Wind className={className} />;
    default:
      return <Cloud className={className} />;
  }
};

export function WeatherBadge({ latitude, longitude }: WeatherBadgeProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!latitude || !longitude) return;
      
      setLoading(true);
      setError(false);
      
      try {
        // Use Open-Meteo free API (no key needed)
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`
        );
        
        if (!response.ok) throw new Error('Weather fetch failed');
        
        const data = await response.json();
        const temp = Math.round(data.current.temperature_2m);
        const condition = getConditionFromCode(data.current.weather_code);
        
        setWeather({
          temp,
          condition,
          description: `${temp}°C, ${condition.charAt(0).toUpperCase() + condition.slice(1)}`,
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [latitude, longitude]);

  if (!latitude || !longitude) return null;
  if (error) return null;
  
  if (loading) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
      </Badge>
    );
  }

  if (!weather) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1.5 cursor-default">
            <WeatherIcon condition={weather.condition} className="h-3.5 w-3.5" />
            <span>{weather.temp}°</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{weather.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
