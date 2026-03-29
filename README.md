# Dynamic Graph Layout Editor

## Purpose

**Dynamic Graph Layout Editor** is a web application that enables users to edit a network graph over a temporal axis with interactive options.

## Technical Infrastructure

The application consists of a Angular 17 frontend for the web tool and a Java console tool for an optimized network layout using the MultiDynNos algorithm.




# Dynamic Graph Layout Editor

An interactive web application for **editing and analyzing dynamic graphs graphs** with a focus on **disease transmission and contact tracing**.

This project combines **automated graph layout algorithms** with **interactive editing**, enabling precise and intuitive exploration of dynamic networks over time.

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

## Tech Stack
- **Frontend:** Angular 17 + D3.js  
- **Backend Tool:** Java (MultiDynNos adjustment)

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


