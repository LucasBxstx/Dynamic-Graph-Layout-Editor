import { AsyncPipe, NgClass, NgIf } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { TourService } from '../../services/tour.service';
import { TourStagePipe } from '../../pipes/tour-stage.pipe';

@Component({
   selector: 'app-tour',
   standalone: true,
   imports: [ NgClass, AsyncPipe, TourStagePipe, NgIf ],
   templateUrl: './tour.component.html',
   styleUrl: './tour.component.scss'
})
export class TourComponent {
   public readonly tourService = inject(TourService);
   @Input() public displaySpot?: 'bottom' | 'left' | 'top' | 'right' = 'left';
}
