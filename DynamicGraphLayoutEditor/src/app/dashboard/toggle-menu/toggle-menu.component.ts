import { Component, inject } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SlideToggleService } from '../../shared/services/slide-toggle.service';
import { FormsModule } from '@angular/forms';
import { AsyncPipe, NgIf } from '@angular/common';
import { TooltipComponent } from '../../shared/components/tooltip/tooltip.component';
import { TourComponent } from '../../shared/components/tour/tour.component';
import { TourService } from '../../shared/services/tour.service';

@Component({
   selector: 'app-toggle-menu',
   standalone: true,
   imports: [ MatSlideToggleModule, FormsModule, AsyncPipe, TooltipComponent, TourComponent, NgIf ],
   templateUrl: './toggle-menu.component.html',
   styleUrl: './toggle-menu.component.scss'
})
export class ToggleMenuComponent {
   public readonly slideToggleService = inject(SlideToggleService);
   public readonly tourService = inject(TourService);
}
