import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SignatureCanvas from "react-signature-canvas";
import { X, Pen, Check } from "lucide-react";

interface SignatureCaptureProps {
  label: string;
  signature: string | null;
  onSignatureChange: (signature: string | null) => void;
  disabled?: boolean;
}

export const SignatureCapture = ({
  label,
  signature,
  onSignatureChange,
  disabled = false,
}: SignatureCaptureProps) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isEditing, setIsEditing] = useState(!signature);

  useEffect(() => {
    if (signature && sigCanvas.current && isEditing) {
      sigCanvas.current.fromDataURL(signature);
    }
  }, [signature, isEditing]);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    onSignatureChange(null);
    setIsEditing(true);
  };

  const confirmSignature = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL();
      onSignatureChange(dataUrl);
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    // Restore the signature to the canvas after a brief delay for re-render
    setTimeout(() => {
      if (signature && sigCanvas.current) {
        sigCanvas.current.fromDataURL(signature);
      }
    }, 50);
  };

  // Show confirmed signature view
  if (signature && !isEditing) {
    return (
      <div className="space-y-2">
        <Label className="text-base font-semibold">{label}</Label>
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <img src={signature} alt="Signature" className="w-full h-32 object-contain" />
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={startEditing}
              className="flex-1 h-12"
            >
              <Pen className="mr-2 h-4 w-4" />
              Edit Signature
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearSignature}
              className="flex-1 h-12"
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Show editable canvas view
  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">{label}</Label>
      <div className="border-2 border-dashed border-border rounded-lg bg-muted/20">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            className: "w-full h-32 touch-none",
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Pen className="h-3 w-3" />
        <span>Sign above with your finger or stylus</span>
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            onClick={confirmSignature}
            className="flex-1 h-12"
          >
            <Check className="mr-2 h-4 w-4" />
            Confirm Signature
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clearSignature}
            className="flex-1 h-12"
          >
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};
