-- Create trade PPE requirements lookup table
CREATE TABLE public.trade_ppe_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_type TEXT NOT NULL,
  ppe_item TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trade_type, ppe_item)
);

-- Enable RLS
ALTER TABLE public.trade_ppe_requirements ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read PPE requirements (reference data)
CREATE POLICY "Anyone can view PPE requirements"
ON public.trade_ppe_requirements
FOR SELECT
USING (true);

-- Insert standard PPE requirements by trade type
INSERT INTO public.trade_ppe_requirements (trade_type, ppe_item, is_mandatory, description) VALUES
-- General (applies to all)
('general', 'Hard Hat', true, 'Head protection required in all construction areas'),
('general', 'Safety Vest', true, 'High-visibility vest for site visibility'),
('general', 'Safety Glasses', true, 'Eye protection for debris and dust'),
('general', 'Steel-Toe Boots', true, 'Foot protection from falling objects'),
('general', 'Gloves', false, 'Hand protection for material handling'),

-- Electrical
('electrical', 'Insulated Gloves', true, 'Class 0 or higher for electrical work'),
('electrical', 'Arc Flash Suit', true, 'Required for panel work above 50V'),
('electrical', 'Face Shield', true, 'Arc flash face protection'),
('electrical', 'Voltage Tester', true, 'Must verify zero energy before work'),

-- Welding
('welding', 'Welding Helmet', true, 'Auto-darkening recommended'),
('welding', 'Welding Gloves', true, 'Heat-resistant leather gloves'),
('welding', 'Leather Apron', true, 'Spark and spatter protection'),
('welding', 'Respirator', true, 'Fume protection required'),

-- Plumbing
('plumbing', 'Chemical Gloves', true, 'Protection from solvents and adhesives'),
('plumbing', 'Knee Pads', false, 'Recommended for ground-level work'),
('plumbing', 'Respirator', false, 'Required in confined spaces'),

-- HVAC
('hvac', 'Respirator', true, 'Required for insulation and refrigerant work'),
('hvac', 'Chemical Gloves', true, 'Protection from refrigerants'),
('hvac', 'Hearing Protection', false, 'Recommended near operating equipment'),

-- Framing/Carpentry
('framing', 'Cut-Resistant Gloves', true, 'Required when using power saws'),
('framing', 'Hearing Protection', true, 'Required with power tools'),
('framing', 'Dust Mask', false, 'Recommended for sawdust'),

-- Concrete
('concrete', 'Rubber Boots', true, 'Protection from wet concrete'),
('concrete', 'Chemical Gloves', true, 'Concrete is caustic to skin'),
('concrete', 'Knee Pads', true, 'Required for finishing work'),

-- Roofing
('roofing', 'Fall Harness', true, 'Required above 6 feet'),
('roofing', 'Knee Pads', true, 'Required for roofing work'),
('roofing', 'Hearing Protection', false, 'Recommended with nail guns'),

-- Drywall
('drywall', 'Dust Mask', true, 'Required for sanding'),
('drywall', 'Knee Pads', false, 'Recommended for low work'),
('drywall', 'Safety Glasses', true, 'Protection from dust and debris'),

-- Painting
('painting', 'Respirator', true, 'Required for spray application'),
('painting', 'Chemical Gloves', true, 'Protection from solvents'),
('painting', 'Coveralls', false, 'Recommended for spray work'),

-- Demolition
('demolition', 'Respirator', true, 'Required for dust and potential hazmat'),
('demolition', 'Hearing Protection', true, 'Required with heavy equipment'),
('demolition', 'Face Shield', true, 'Flying debris protection'),

-- Excavation
('excavation', 'Hearing Protection', true, 'Required near heavy equipment'),
('excavation', 'Reflective Vest', true, 'High-visibility near equipment'),

-- Height Work (general)
('height_work', 'Fall Harness', true, 'Required above 6 feet'),
('height_work', 'Lanyard', true, 'Must be connected at all times'),
('height_work', 'Hard Hat with Chin Strap', true, 'Prevents falling hard hat hazard');

-- Add comment
COMMENT ON TABLE public.trade_ppe_requirements IS 'Lookup table for PPE requirements by trade type. Used for AI-powered safety log PPE checklists.';