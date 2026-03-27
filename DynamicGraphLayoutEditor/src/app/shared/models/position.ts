export interface GraphicsGML {
   x: number;
   y: number;
   w: number;
   h: number;
}

export interface Position {
   x: number;
   y: number;
}

export interface PositionWithFrame extends Position {
   frame: number;
}
