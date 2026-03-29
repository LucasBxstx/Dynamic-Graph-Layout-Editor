# Dynamic Graph Layout Editor


An interactive web application for **editing and analyzing dynamic graphs** with a focus on **disease transmission and contact tracing**.

This project combines **automated graph layout algorithms** with **interactive editing**, enabling precise and intuitive exploration of dynamic graphs over time.

<img width="1442" height="657" alt="image" src="https://github.com/user-attachments/assets/61a4aa2c-492e-4e7b-a9d0-59a95ded9df4" />


## Background

Understanding how diseases spread in environments like hospitals requires analyzing **who interacted with whom — and when**.

Most existing tools:
- rely on **time slices**
- lose **temporal precision**
- lack **interactive editing capabilities**

This project solves that by enabling:
- **event-based temporal visualization**
- **continuous time exploration**
- **interactive layout refinement**

<br></br>
## Features

### Intelligent Layout + Human Refinement
- Automatic layout generation using **MultiDynNos**
- Manual refinement via **keyframe-based editing**

### Interactive Temporal Graph Editor
- Explore dynamic node-link diagrams in a browser
- Smooth zooming, navigation, and animation
- Timeline-based interaction for time navigation

### Advanced Time-Based Interaction
- Interactive timeline with **event markers**
- Playback controls:
  - Play / Pause
  - Step forward / backward
  - Adjustable speed & FPS
- Jump directly to relevant events

### Editing & Data Capabilities

- Create new graphs or import real-world datasets
- Add, delete, and modify nodes and links directly
- Edit:
  - Node positions over time (keyframes)
  - Link durations
  - Infection states
- Save and reload projects (JSON format)
- Undo functionality for safe iteration

### Visual Analytics Features

<img width="1467" height="721" alt="image" src="https://github.com/user-attachments/assets/0eb0beee-1cf4-431c-9ee3-35acba30480e" />
#### Infection State Visualization
- Nodes are color-coded by health status
- Track disease progression over time

#### Location-Based Context
- Toggle to visualize interaction locations
- Links and nodes reflect spatial context

#### Trajectory Analysis
- Node trajectories → movement over time
- Link trajectories → historical contact patterns

#### Smart Filtering
- Focus on selected nodes/links
- Reduce clutter in dense graphs


#### Layout Comparison
- Compare edited layout with original algorithm output

<br></br>
## Tech Stack
- **Frontend:** Angular 17 + D3.js  
- **Backend Tool:** Java (MultiDynNos adjustment)

<br></br>
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

<br></br>
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


