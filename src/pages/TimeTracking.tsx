import { Layout } from '@/components/Layout';
import { Clock, Play, Pause, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TimeTracking() {
  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Time Tracking</h1>
            <p className="text-muted-foreground">Track time spent on tasks and projects</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0h 0m</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0h 0m</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Timer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg">No active timer</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No time entries yet</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking time by clicking the button above
              </p>
              <Button variant="outline">
                <Play className="h-4 w-4 mr-2" />
                Start Timer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
