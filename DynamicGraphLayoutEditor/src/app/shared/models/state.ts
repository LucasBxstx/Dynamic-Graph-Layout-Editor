export interface StateData {
   id: number;
   name: string;
   color: string;
}

export interface InfectionRawData {
   id: string;
   changes: {
      timestamp: number;
      status: string;
   }[];
}
