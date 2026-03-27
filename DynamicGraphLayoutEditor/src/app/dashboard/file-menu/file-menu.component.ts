import { Component, inject } from '@angular/core';
import { NetworkDataService } from '../../shared/services/network-data.service';
import { AsyncPipe, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { TourComponent } from '../../shared/components/tour/tour.component';
import { TourService } from '../../shared/services/tour.service';

@Component({
   selector: 'app-file-menu',
   standalone: true,
   imports: [ AsyncPipe, NgIf, TourComponent ],
   templateUrl: './file-menu.component.html',
   styleUrl: './file-menu.component.scss'
})
export class FileMenuComponent {
   public readonly networkDataService = inject(NetworkDataService);
   public readonly tourService = inject(TourService);
   private readonly router = inject(Router);

   public navigateToLandingPage (): void {
      this.router.navigate([ 'landing' ]);
   }

   public navigateToProjectSettings (): void {
      this.router.navigate([ 'create-new-project' ], {
         queryParams: {
            usecase: 'edit'
         }
      });
   }
}
