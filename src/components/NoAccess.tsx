import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface NoAccessProps {
  title?: string;
  message?: string;
  returnPath?: string;
  returnLabel?: string;
}

export const NoAccess = ({
  title = "Limited Access",
  message = "Your role doesn't allow you to view this page.",
  returnPath = "/dashboard",
  returnLabel = "Back to Dashboard",
}: NoAccessProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-6 mb-6">
        <Shield className="h-16 w-16 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3">{title}</h2>
      <p className="text-muted-foreground max-w-md mb-6">{message}</p>
      <Button onClick={() => navigate(returnPath)} variant="default">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {returnLabel}
      </Button>
    </div>
  );
};
