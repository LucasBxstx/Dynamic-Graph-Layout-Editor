# Dynamic Graph Layout Editor

## Purpose

**Dynamic Graph Layout Editor** is a web application that enables users to edit a network graph over a temporal axis with interactive options.

## Technical Infrastructure

The application consists of a Angular 17 frontend for the web tool and a Java console tool for an optimized network layout using the MultiDynNos algorithm.

## Installation

### Requirements

1. Installation of

   - Git
     (Dynamic Graph Layout Editor)
   - Node.js 18+
   - npm 9+
     (MultiDynNos)
   - Maven
   - Graphviz

2. Clone the repository
   ```bash
   https://git.cs.uni-koeln.de/visva-lehre/va-praktikum/dynamic-graph-layout-editor.git
   ```

### Set up MultiDynNos

See the ReadMe for MultiDynNos in /Edited MultiDynNos

### Set up Frontend

1. Open the frontend (folder: dynamic-graph-layout-editor) in preferably VS Code

2. For the installation of Angular following command is needed:

   ```bash
   npm install -g @angular/cli@17
   ```

3. Install all required packages

   ```bash
   npm install
   ```

4. Open the terminal in the root folder of the frontend

5. Run the frontend on a local webserver

   ```bash
   ng serve
   ```

6. Open a browser window and go to

   ```bash
   http://localhost:4200
   ```

   Now the Application should run

7. To build the application you can use

   ```bash
   ng build --configuration=production
   ```

   The final application bundle is found in the dist folder

## Usage

The user can load contact and infection data into the Dynamic Graph Layout Editor. For an initial layout of the network diagram, the user can use the generated Layouts in /ExampleHospitalData. Once these 3 files are imported into the tool, the user can edit the graph interactively

## Contributing

1. Fork the repository.
2. Create a new branch for your feature:

   ```bash
   git checkout -b "feature/[your-feature]"

   ```

3. Make your changes and commit them:

   ```bash
   git commit -m "[frontend/backend: your feature description]"

   ```

4. Push the branch to your fork:

   ```bash
   git push origin feature/[your-feature]

   ```

5. Open a Pull Request.
