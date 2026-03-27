import { Pipe, PipeTransform } from '@angular/core';
import { Stage } from '../models/tour';

@Pipe({
   name: 'tourStage',
   standalone: true
})
export class TourStagePipe implements PipeTransform {
   transform (stage: Stage | null): string {
      switch (stage) {
         case 'network-graph':
            return 'Network Graph';
         case 'playback-control':
            return 'Playback Control';
         case 'file-menu':
            return 'File Menu';
         case 'legend-health-states':
            return 'Legend: Health States';
         case 'legend-locations':
            return 'Legend: Locations';
         case 'event-lines':
            return 'Contact and Infection Events';
         case 'toggle-menu':
            return 'Toggle Menu';
         case 'edit-options':
            return 'Editing Options';
         default:
            return 'none';
      }
   }
}
