import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
   standalone: true,
   name: 'timeFormat'
})
export class TimeFormatPipe implements PipeTransform {
   transform (value: number): string {
      if (isNaN(value) || value < 0) {
         return '0:00';
      }

      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;

      return `${minutes}:${paddedSeconds}`;
   }
}
