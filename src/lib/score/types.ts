export type ScoreDiagnosticLevel = "error" | "warning" | "info";

export type ScoreDiagnostic = {
  level: ScoreDiagnosticLevel;
  code: string;
  message: string;
  path?: string;
};

export type ScoreXmlNode = {
  name: string;
  attributes?: Record<string, string>;
  text?: string;
  children?: ScoreXmlNode[];
};

export type ScoreTree = {
  root: ScoreXmlNode;
};

export type ScoreBuildResult = {
  tree: ScoreTree | null;
  diagnostics: ScoreDiagnostic[];
  stats: {
    adapterId: string;
    noteCount: number;
    measureCount: number;
    partCount: number;
    streamCount: number;
  };
};

export type ScorePluginRuntimeData = {
  adapterId: string;
  musicXml: string;
  diagnostics: ScoreDiagnostic[];
  stats: ScoreBuildResult["stats"];
};

export type ScoreArticulationEvent = {
  element: string;
  placement?: "above" | "below";
  sourcePath?: string;
};

export type ScoreSlurEvent = {
  number: number;
  type: "start" | "stop" | "continue";
  placement?: "above" | "below";
  sourcePath?: string;
};

export type ScoreMeterEvent = {
  time: number;
  beats: number;
  beatType: number;
  sourcePath?: string;
};

export type ScorePartEvent = {
  part: number;
  staffCount?: number;
  sourcePath?: string;
};

export type ScoreClefEvent = {
  time: number;
  part: number;
  staff: number;
  sign: string;
  line: number;
  sourcePath?: string;
};

export type ScoreTempoEvent = {
  time: number;
  bpm: number;
  sourcePath?: string;
};

export type ScoreKeyEvent = {
  time: number;
  part?: number;
  fifths: number;
  mode?: string;
  sourcePath?: string;
};

export type ScoreNoteEvent = {
  eventId?: number;
  pitch: number;
  time: number;
  duration: number;
  velocity?: number;
  dynamicCode?: number;
  voice?: number;
  staff?: number;
  part?: number;
  articulations?: ScoreArticulationEvent[];
  slurs?: ScoreSlurEvent[];
  sourcePaths?: string[];
};
