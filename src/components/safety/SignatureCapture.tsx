import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SignatureCanvas from "react-signature-canvas";
import { X, Pen } from "lucide-react";

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

  useEffect(() => {
    if (signature && sigCanvas.current) {
      sigCanvas.current.fromDataURL(signature);
    }
  }, [signature]);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    onSignatureChange(null);
  };

  const saveSignature = () => {
    if (sigCanvas.current) {
      const dataUrl = sigCanvas.current.toDataURL();
      onSignatureChange(dataUrl);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">{label}</Label>
      
      {signature ? (
        <div className="space-y-2">
          <div className="border border-border rounded-lg overflow-hidden bg-background">
            <img src={signature} alt="Signature" className="w-full h-32 object-contain" />
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              onClick={clearSignature}
              className="w-full h-12"
            >
              <X className="mr-2 h-4 w-4" />
              Clear Signature
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="border-2 border-dashed border-border rounded-lg bg-muted/20">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: "w-full h-32 touch-none",
              }}
              onEnd={saveSignature}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Pen className="h-3 w-3" />
            <span>Sign above with your finger or stylus</span>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              onClick={clearSignature}
              className="w-full h-12"
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
