## Soma Capital Technical Assessment

This is a technical assessment as part of the interview process for Soma Capital.

> [!IMPORTANT]  
> You will need a Pexels API key to complete the technical assessment portion of the application. You can sign up for a free API key at https://www.pexels.com/api/  

To begin, clone this repository to your local machine.

## Development

This is a [NextJS](https://nextjs.org) app, with a SQLite based backend, intended to be run with the LTS version of Node.

To run the development server:

```bash
npm i
npm run dev
```

## Task:

Modify the code to add support for due dates, image previews, and task dependencies.

### Part 1: Due Dates 

When a new task is created, users should be able to set a due date.

When showing the task list is shown, it must display the due date, and if the date is past the current time, the due date should be in red.

### Part 2: Image Generation 

When a todo is created, search for and display a relevant image to visualize the task to be done. 

To do this, make a request to the [Pexels API](https://www.pexels.com/api/) using the task description as a search query. Display the returned image to the user within the appropriate todo item. While the image is being loaded, indicate a loading state.

You will need to sign up for a free Pexels API key to make the fetch request. 

### Part 3: Task Dependencies

Implement a task dependency system that allows tasks to depend on other tasks. The system must:

1. Allow tasks to have multiple dependencies
2. Prevent circular dependencies
3. Show the critical path
4. Calculate the earliest possible start date for each task based on its dependencies
5. Visualize the dependency graph

## Submission:

1. Add a new "Solution" section to this README with a description and screenshot or recording of your solution. 
2. Push your changes to a public GitHub repository.
3. Submit a link to your repository in the application form.

Thanks for your time and effort. We'll be in touch soon!

## Solution

Hello! This is my submission for the Soma Technical Assessment, completed with liberal use of AI to complete in a timely manner and to work with new frameworks I had been unfamiliar with before.

I have completed all three tasks and have included screenshots of the completed assessment in the `assets` folder in the main root.

Click on a task to access a modal with all of the dependency interactions for Task 3.

As for the broad strokes of my solution:
  - I updated the model in `schema.prisma` in order to track both a `due` DateTime field (for the due date of a task) and a many-to-many foreign-key table to track `dependencies` (to track the `id` of other tasks).
    - If thee current date is past a task's due date, the due date's font color is changed to red. 
  - I updated the default endpoint's `POST` in order to post the `due` field to the database.
  - I added to the `[id]` endpoint for a few things:
    - A separate `GET` request which rather than getting a single task, retrieves the task's title and then queries Pexel's API to search and return an image for that task. This is separate from the default route's `GET`, which returns all tasks.
    - A `PATCH` request, which updates the `[id]` task's dependency table. It does this by expeceting `dependency: number`, which is the id of the dependency. It validates whethere the id of the task added will cause a circular dependency or not, and terminates if it would. If the dependency is already in `[id]`'s dependency array, it instead removes it as a way of toggling.
  - I added a `TodoGraph.tsx` component, which makes use of `reactflow` and `dagre` imported packages to reduce the time needed to create a proper DAG for the dependency graph in Task 3.
    - The graph shows the dependency chain downstream of the selected task. It also shows a red line indicating the critical path, presumed to be the longest chain of individual tasks, rather than duration/time-based.
  - On the frontend, I made a variety of additions for the tasks.
    - The due date for each task is shown and colored in red if past.
    - A sized image obtained via Pexel's API is loaded in for each task, with a loading indicator if it takes some time. My Pexel's secret is within the code, but can easily be extracted into a `.env`. I am choosing not to since this is just an assessment and the key is rate-limited and free.
    - Clicking on a task brings up a modal showing the task's dependency graph, earliest start date (presumed to be the latest dependent task's due date and/or the current date), and a menu to select other tasks to be dependent on the current one.
   
Here are some screenshots, though there are more in `assets` if you want to see more.

![App Screenshot][./assets/Screenshot 2025-08-21 140434.png]

![App Screenshot][./assets/Screenshot 2025-08-21 140331.png]

As for future work, there are quite a few things I would improve on this assessment:
- Modals could be adapted to scroll. Currently too many tasks or excessively long task titles cause clickable options to go off the screen.
- Modal code could likely be refactored into its ownw component to allow for more readability.
- Dependency validation code doesn't account for task due dates. This should be changed so a task due on 9/30 can't be added as a dependent to a task due on 9/1.
- Earliest possible start date could likely be interpreted differently. I took the simplest interpretation.
