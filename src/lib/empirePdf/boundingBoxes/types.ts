export type BoundingBoxAlignment = "left" | "center" | "right";

export type BoundingBoxFieldDefinition = {
  fieldId: string;
  page: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  alignment: BoundingBoxAlignment;
  lineSpacing: number;
  maxFontSize: number;
  minFontSize: number;
  multiline: boolean;
  isCheckbox?: boolean;
};

export type BoundingBoxTextLayout = {
  fieldId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  text: string;
};

export type BoundingBoxCheckboxLayout = {
  fieldId: string;
  page: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  strokeWidth: number;
};
