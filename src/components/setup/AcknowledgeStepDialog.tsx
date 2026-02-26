import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AcknowledgeStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepLabel: string;
  description: string;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for setup steps that cannot be auto-detected.
 * Forces the user to explicitly acknowledge they've completed the work
 * outside the app before marking the step done.
 */
export function AcknowledgeStepDialog({
  open,
  onOpenChange,
  stepLabel,
  description,
  onConfirm,
}: AcknowledgeStepDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm: {stepLabel}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{description}</p>
            <p className="font-medium text-foreground">
              By confirming, you acknowledge that you have completed this step.
              This cannot be automatically verified by the system.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, I've completed this
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
