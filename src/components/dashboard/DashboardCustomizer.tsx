import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Save, RotateCcw, X, Eye, EyeOff } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DashboardCustomizerProps {
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  hiddenWidgets: string[];
  onToggleWidget: (widgetId: string) => void;
  onSave: () => void;
  onReset: () => void;
}

const WIDGET_NAMES: Record<string, string> = {
  metrics: 'Key Metrics',
  activity: 'Task Activity',
  health: 'Project Health',
  distribution: 'Task Distribution',
  myday: 'My Day',
  safety: 'Safety & Compliance',
  blockers: 'Blockers & Risks',
  ai: 'AI Assistant',
  'hours-tracking': 'Hours Tracking',
};

export const DashboardCustomizer = ({
  isEditMode,
  setIsEditMode,
  hiddenWidgets,
  onToggleWidget,
  onSave,
  onReset,
}: DashboardCustomizerProps) => {
  return (
    <div className="flex items-center gap-2">
      {isEditMode ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onSave();
              setIsEditMode(false);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Layout
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onReset();
              setIsEditMode(false);
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditMode(false)}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </>
      ) : (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Customize Dashboard</SheetTitle>
              <SheetDescription>
                Toggle widgets on/off and drag to rearrange your dashboard layout.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="mt-6 h-[calc(100vh-140px)]">
              <div className="space-y-6 pr-4">
                {/* Edit Layout first so it's immediately visible */}
                <Card className="bg-muted/50 border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Edit Layout</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Enable edit mode to drag and resize widgets.
                    </p>
                    <Button
                      onClick={() => setIsEditMode(true)}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Enable Edit Mode
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Widget Visibility</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(WIDGET_NAMES).map(([id, name]) => (
                      <div key={id} className="flex items-center justify-between">
                        <Label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
                          {hiddenWidgets.includes(id) ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-secondary" />
                          )}
                          {name}
                        </Label>
                        <Switch
                          id={id}
                          checked={!hiddenWidgets.includes(id)}
                          onCheckedChange={() => onToggleWidget(id)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="text-xs text-muted-foreground pb-4">
                  <p>💡 Tip: Your layout is saved per project and synced across devices.</p>
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
