import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Users, UserCheck, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Attendee {
  id: string;
  user_id: string;
  full_name: string | null;
  email?: string;
  avatar_url?: string | null;
  trade_name?: string | null;
  is_present_today?: boolean;
}

export interface SelectedAttendee {
  user_id: string;
  is_foreman: boolean;
}

interface AttendeeSelectorProps {
  attendees: Attendee[];
  selectedAttendees: SelectedAttendee[];
  onSelectionChange: (selected: SelectedAttendee[]) => void;
  presentTodayIds?: string[];
  loading?: boolean;
}

export const AttendeeSelector = ({
  attendees,
  selectedAttendees,
  onSelectionChange,
  presentTodayIds = [],
  loading = false,
}: AttendeeSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAttendees = useMemo(() => {
    if (!searchQuery) return attendees;
    const query = searchQuery.toLowerCase();
    return attendees.filter(
      (a) =>
        a.full_name?.toLowerCase().includes(query) ||
        a.email?.toLowerCase().includes(query) ||
        a.trade_name?.toLowerCase().includes(query)
    );
  }, [attendees, searchQuery]);

  const isSelected = useCallback(
    (userId: string) => selectedAttendees.some((a) => a.user_id === userId),
    [selectedAttendees]
  );

  const isForeman = useCallback(
    (userId: string) =>
      selectedAttendees.find((a) => a.user_id === userId)?.is_foreman ?? false,
    [selectedAttendees]
  );

  const toggleAttendee = useCallback(
    (userId: string) => {
      const existing = selectedAttendees.find((a) => a.user_id === userId);
      if (existing) {
        onSelectionChange(selectedAttendees.filter((a) => a.user_id !== userId));
      } else {
        onSelectionChange([...selectedAttendees, { user_id: userId, is_foreman: false }]);
      }
    },
    [selectedAttendees, onSelectionChange]
  );

  const toggleForeman = useCallback(
    (userId: string) => {
      onSelectionChange(
        selectedAttendees.map((a) =>
          a.user_id === userId ? { ...a, is_foreman: !a.is_foreman } : a
        )
      );
    },
    [selectedAttendees, onSelectionChange]
  );

  const selectAllPresent = useCallback(() => {
    const presentSelected: SelectedAttendee[] = presentTodayIds.map((id) => ({
      user_id: id,
      is_foreman: selectedAttendees.find((a) => a.user_id === id)?.is_foreman ?? false,
    }));
    onSelectionChange(presentSelected);
  }, [presentTodayIds, selectedAttendees, onSelectionChange]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attendees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-12"
        />
      </div>

      {/* Quick Actions */}
      {presentTodayIds.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={selectAllPresent}
          className="w-full h-12 gap-2"
        >
          <UserCheck className="h-4 w-4" />
          Select All Present Today ({presentTodayIds.length})
        </Button>
      )}

      {/* Selected count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {selectedAttendees.length} selected
        </span>
        {selectedAttendees.some((a) => a.is_foreman) && (
          <Badge variant="outline" className="gap-1">
            <Crown className="h-3 w-3" />
            Foreman assigned
          </Badge>
        )}
      </div>

      {/* Attendee List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {filteredAttendees.map((attendee) => {
          const selected = isSelected(attendee.user_id);
          const foreman = isForeman(attendee.user_id);
          const presentToday = presentTodayIds.includes(attendee.user_id);

          return (
            <div
              key={attendee.id}
              onClick={() => toggleAttendee(attendee.user_id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                "min-h-[64px] active:scale-[0.98] touch-manipulation",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-accent/50",
                presentToday && !selected && "border-green-500/30 bg-green-500/5"
              )}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => toggleAttendee(attendee.user_id)}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5"
              />

              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={attendee.avatar_url || undefined} />
                <AvatarFallback>{getInitials(attendee.full_name)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {attendee.full_name || attendee.email || "Unknown"}
                  </span>
                  {presentToday && (
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                      On site
                    </Badge>
                  )}
                </div>
                {attendee.trade_name && (
                  <span className="text-sm text-muted-foreground">{attendee.trade_name}</span>
                )}
              </div>

              {/* Foreman toggle */}
              {selected && (
                <Button
                  type="button"
                  variant={foreman ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleForeman(attendee.user_id);
                  }}
                  className={cn(
                    "flex-shrink-0 gap-1 h-9",
                    foreman && "bg-amber-500 hover:bg-amber-600"
                  )}
                >
                  <Crown className="h-3.5 w-3.5" />
                  Foreman
                </Button>
              )}
            </div>
          );
        })}

        {filteredAttendees.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No attendees found</p>
          </div>
        )}
      </div>
    </div>
  );
};
