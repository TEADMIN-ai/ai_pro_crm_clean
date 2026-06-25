import type { QsBoqExtractionSource, QsBoqFileType } from "@/types/qs";

export type QsBoqParsedDocument = {
  fileType: QsBoqFileType;
  parserUsed: string;
  extractionSource: QsBoqExtractionSource;
  ocrUsed: boolean;
  text: string;
  pageCount?: number;
};

export type QsBoqParserInput = {
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
};
