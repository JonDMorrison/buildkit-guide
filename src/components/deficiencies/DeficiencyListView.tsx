import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { TradeBadge } from "@/components/TradeBadge";
import { format } from "date-fns";
import { Image } from "lucide-react";

interface Deficiency {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "fixed" | "verified";
  priority: number;
  location: string | null;
  due_date: string | null;
  created_at: string;
  trades: {
    company_name: string;
    trade_type: string;
  } | null;
  attachments?: Array<{
    id: string;
    file_url: string;
    file_type: string;
  }>;
}

interface DeficiencyListViewProps {
  deficiencies: Deficiency[];
  onDeficiencyClick: (id: string) => void;
}

const getStatusType = (status: string): "complete" | "progress" | "blocked" | "info" => {
  switch (status) {
    case "verified":
      return "complete";
    case "in_progress":
      return "progress";
    case "open":
      return "blocked";
    case "fixed":
      return "info";
    default:
      return "info";
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "fixed":
      return "Fixed";
    case "verified":
      return "Verified";
    default:
      return status;
  }
};

export const DeficiencyListView = ({ deficiencies, onDeficiencyClick }: DeficiencyListViewProps) => {
  return (
    <div className="space-y-3">
      {deficiencies.map((deficiency) => {
        const photoAttachments = deficiency.attachments?.filter((att) =>
          att.file_type.startsWith("image/")
        ) || [];
        const firstPhoto = photoAttachments[0];

        return (
          <Card
            key={deficiency.id}
            className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onDeficiencyClick(deficiency.id)}
          >
            <div className="flex gap-4">
              {/* Photo Thumbnail */}
              <div className="flex-shrink-0">
                {firstPhoto ? (
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-muted">
                    <img
                      src={firstPhoto.file_url}
                      alt="Deficiency"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground truncate">{deficiency.title}</h3>
                  <StatusBadge
                    status={getStatusType(deficiency.status)}
                    label={getStatusLabel(deficiency.status)}
                  />
                </div>

                {deficiency.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {deficiency.description}
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {deficiency.trades && (
                    <TradeBadge trade={deficiency.trades.trade_type} />
                  )}
                  {deficiency.location && (
                    <span className="text-xs text-muted-foreground">{deficiency.location}</span>
                  )}
                  {deficiency.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Due: {format(new Date(deficiency.due_date), "MMM d")}
                    </span>
                  )}
                  {photoAttachments.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      +{photoAttachments.length - 1} photos
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
