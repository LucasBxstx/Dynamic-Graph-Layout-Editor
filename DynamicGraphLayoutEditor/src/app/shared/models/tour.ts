export interface TourStage {
   order: number;
   stage: Stage;
}

export type Stage =
   | 'none'
   | 'network-graph'
   | 'playback-control'
   | 'file-menu'
   | 'legend-health-states'
   | 'legend-locations'
   | 'event-lines'
   | 'toggle-menu'
   | 'edit-options';
