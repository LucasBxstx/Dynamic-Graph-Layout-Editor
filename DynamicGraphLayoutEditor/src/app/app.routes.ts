import { Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { CreateNewProjectComponent } from './create-new-project/create-new-project.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ManageImportedFilesComponent } from './manage-imported-files/manage-imported-files.component';
import { AddNodeComponent } from './dashboard/add-node/add-node.component';
import { AddStatusOrLocationComponent } from './dashboard/add-status-or-location/add-status-or-location.component';
import { SelectLocationOrStatusComponent } from './dashboard/select-location-or-status/select-location-or-status';
import { DeleteObjectsComponent } from './dashboard/delete-objects/delete-objects.component';

export const routes: Routes = [
   {
      path: '',
      redirectTo: 'landing',
      pathMatch: 'full'
   },
   {
      path: 'landing',
      component: LandingPageComponent
   },
   {
      path: 'manage-imported-files',
      component: ManageImportedFilesComponent
   },
   {
      path: 'create-new-project',
      component: CreateNewProjectComponent
   },
   {
      path: 'dashboard',
      component: DashboardComponent,
      children: [
         {
            path: 'add-node',
            component: AddNodeComponent,
            outlet: 'modal'
         },
         {
            path: 'add-status',
            component: AddStatusOrLocationComponent,
            outlet: 'modal'
         },
         {
            path: 'add-location',
            component: AddStatusOrLocationComponent,
            outlet: 'modal'
         },
         {
            path: 'select-location',
            component: SelectLocationOrStatusComponent,
            outlet: 'modal'
         },
         {
            path: 'select-status',
            component: SelectLocationOrStatusComponent,
            outlet: 'modal'
         },
         {
            path: 'delete-objects',
            component: DeleteObjectsComponent,
            outlet: 'modal'
         }
      ]
   },
   { path: '**', component: LandingPageComponent }
];
