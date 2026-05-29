export type BoundingBoxAlignment = "left" | "center" | "right";
export type OverflowBehavior = "truncate" | "scale" | "wrap";
export type CheckboxRenderStyle = "tick" | "x" | "filled_square";

export type RawBoundingBoxFieldDefinition = {
  fieldId: string;
  page: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  alignment: BoundingBoxAlignment;
  lineSpacing?: number;
  lineHeight?: number;
  padding?: number;
  maxLines?: number;
  overflowBehavior?: OverflowBehavior;
  maxFontSize: number;
  minFontSize: number;
  multiline: boolean;
  isCheckbox?: boolean;
  checkboxStyle?: CheckboxRenderStyle;
  templateVersion?: string;
  fieldVersion?: string;
};

export type BoundingBoxFieldDefinition = RawBoundingBoxFieldDefinition & {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  lineHeight: number;
  padding: number;
  maxLines: number;
  overflowBehavior: OverflowBehavior;
  checkboxStyle: CheckboxRenderStyle;
  templateVersion: string;
  fieldVersion: string;
};

export type BoundingBoxTemplateDefinition = {
  formId: string;
  templateVersion: string;
  fields: Record<string, RawBoundingBoxFieldDefinition>;
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
  lines: string[];
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
};

export type BoundingBoxCheckboxLayout = {
  fieldId: string;
  page: number;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  strokeWidth: number;
  style: CheckboxRenderStyle;
};
