import { Component, inject, Input, OnChanges, SimpleChanges } from '@angular/core';

import { AsyncPipe, NgClass, NgFor, NgIf, NgStyle } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TourService } from '../../shared/services/tour.service';
import { TourComponent } from '../../shared/components/tour/tour.component';

export interface LegendData {
   name: string;
   color: string;
}
@Component({
   selector: 'app-legend',
   standalone: true,
   imports: [ NgFor, NgStyle, NgIf, NgClass, AsyncPipe, TourComponent ],
   templateUrl: './legend.component.html',
   styleUrl: './legend.component.scss'
})
export class LegendComponent implements OnChanges {
   public readonly tourService = inject(TourService);
   private readonly router = inject(Router);
   private readonly route = inject(ActivatedRoute);

   public displayTwoColumns = false;

   @Input({ required: true }) context!: 'status' | 'location';
   @Input() public legendData: LegendData[] | null = null;

   public ngOnChanges (changes: SimpleChanges): void {
      if ('legendData' in changes) {
         if (!this.legendData) {
            return;
         }

         this.displayTwoColumns = this.legendData?.length > 3;
      }
   }

   public navigateToEditingSettings (): void {
      this.router.navigate([ { outlets: { modal: [ this.context === 'status' ? 'add-status' : 'add-location' ] } } ], {
         relativeTo: this.route
      });
   }
}
