import { NgClass } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { fromEvent, Subject, takeUntil } from 'rxjs';

@Component({
   selector: 'app-tooltip',
   standalone: true,
   imports: [ NgClass ],
   templateUrl: './tooltip.component.html',
   styleUrl: './tooltip.component.scss'
})
export class TooltipComponent implements OnInit, OnDestroy {
   private unsubscribe: Subject<void> = new Subject();

   private responsive = false;

   public displaySpot?: 'bottom' | 'left' = 'left';
   public showTooltip: boolean = false;

   @Input() public tooltipText?: string;

   @Input() public set displayBehavior (value: 'bottom' | 'responsive' | 'left') {
      if (value === 'responsive') {
         this.responsive = true;
         return;
      }

      this.displaySpot = value;
   }

   public ngOnInit (): void {
      if (this.responsive) {
         this.determineTooltipDisplaySpot();
      }

      fromEvent(window, 'resize')
         .pipe(takeUntil(this.unsubscribe))
         .subscribe(() => {
            if (this.responsive) {
               this.determineTooltipDisplaySpot();
            }
         });
   }

   public ngOnDestroy (): void {
      this.unsubscribe.next();
      this.unsubscribe.complete();
   }

   private determineTooltipDisplaySpot (): void {
      this.displaySpot = document.documentElement.clientWidth > 600 ? 'left' : 'bottom';
   }
}
