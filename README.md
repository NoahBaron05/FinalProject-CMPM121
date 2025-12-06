# Devlog Entry - [11/14/25]

## Introducing the team

**Tools Lead:** Noah Baron

**Testing Lead:** Nicholas Wadsworth

**Engine Leads:** Mahir Camci, Matt Embree

**Design Lead:** Bayo Bandele

## Tools and materials

**Engine/Language:** For our final project, we will be using typecript as our base language, and using three.js and ammo.js for our 3D rendering and physics. We chose this for a couple of reasons. The first is that we all are familiar with typescript, and we don't want to spend extra time learning a new language. Second, we want some practice utilizing different libraries, and learning how to implement a new library into a project, as well as research it's inner workings.

**Tools:** For our tools, we will primarily be coding on codespace. This will keep it simple to have our automated processes in place, and to keep everything standard and the same on every device. We also want to use this so that we can more easily use the live sharing code feature, so that we can simultaneously edit code on the same commit. We also will be using linters, and automatic code formatting to ensure that our code remains consistent stylewise, and also blocking commits if they do not pass specific type checks and error prevention. We also will be running a couple of post commit automations, in order to automatically deploy our game to the web and automatically update the url. This automation may also include our testing scripts, and ensuring that the game works as we expect it to.

**Generative AI:** We are open to using generative AI in our project. We all are pretty busy with projects from other classes, so we will be using generative AI to help support in some of the bulk work in writing our code, as well as helping with understanding how to use the given libraires. Our inital rule is to stay away from AI, until it's needed for the sake of time and understanding. However, we will be using the autocomplete features in github Copilot, in order to save time, becuase most of Copiliots suggestions are what is going to be implemented.

## Outlook

**What do you anticipate being the hardest or riskiest part of the project?**

We anticipate that the hardest part of this project will be learning how to use the tools. Using a 3D rendering library with typescript seems to be a difficult task, so we're expecting to run into some difficulty in that area. Most of the difficulty will come from the start, where we will be initially figuring out how the libraries work, and how to implement them into our project.

**What are you hoping to learn by approaching the project with the tools and materials you selected above?**

We hope to learn mainly how to use and implement unique libraries in basic languages. Typescript doesn't nativley support any of the implementation that we are planning on using, so we're excited to learn how to use a library that fundamentally changes how typescript can represent data. It will be a challenge, but it's an exciting prospect to learn how to understand a new significant library, and how it can be properly implemented into our projects.

## Devlog Entry - [12/4/25]

## How we satisfied the software requirements

In order to satisfy the F1 requirements, our team first decided to use typescript as our main language, with using three.js and cannon-es as our 3D and physics libraries for implementation. For our physics based puzzle, we implemented a rope swing system. In our 3D environment, there is a rope with a ball attached to the end of it, and it is swinging like a pendulum. On the ground next to the rope and ball, there is an open cup. The player has the ability to cut the rope and attempt to cut it at the precise moment so it will fall into the cup, which triggers the win state for our game, which is projected onto the screen. For our codebase implementation, we used the standards of this class for pre-commit tests and post-commit automation. This included auto linting and formatting using deno, and vite to power our website. Github is setup with pages and actions to automatically test and deploy websites after pushing to main, and will give us a success or failure code based on how the deployment happens.

## Reflection

We had to change a couple of main things during implementation of our project. Our biggest one was that we swapped our main physics engine. We swapped from using ammo.js to using CANNON-es, which worked out for our benefit. We were having a lot of trouble getting the ammo.js system to work well with three.js, and we were running into a lot of different issues. We started to look around at a couple of different physics system, and through some trial and error we found CANNON-es, which worked well for the simple and clean design we wanted for our game. Moving forward, we will continue to use CANNON-es rather than ammo.js, because its implementation worked far better for our project. We also had to change a couple of the ways our physics puzzle was laid out. Initially the rope was swinging from the top segment, but through testing it proved really difficult to predict what the rope was doing and how to cut it properly. We eventually ended up switching it so that the rope would actually be swung by an invisible force pressing on the ball, making it so there was a predicable pendulum like motion to the swining, which was a lot better during user testing phases.

## Devlog Entry - [12/5/25]

## How we satisfied the software requirements 2

1. Our team continued to use three.js for our 3D implementation for our world. We also continued to use Cannon-es for our physics system, as we already had the physics working, and there was no need for a change.
2. We implemented scene changes througha door that can be walked through in gameplay. We have different functions in our main.ts to load a scene based on what is needed, as well as changing what needs to be animated based off of the scene name in the initScene() function. Each scene has it's own unique models and simulations inside of them, they can be isolated from each other.
3. We implemented a knife in the first room that can be picked up by the player. This is done simply by looking the camera at the knife and emplying raycasting. This involved creating a spawnKnife function, as well as creating it in the intro scene. When the knife is picked up, it is destoryed and removed from the world, and the knife text is added to the player's inventory. Not every object can be picked up in the game, but only ones that have a special flag to denot that they are able to be picked up. Currently in implementation, only the knife is a pickuppable object.
4. We implemented an inventory system by creating two classes, and inventory UI and and inventory class. The inventory class manages adding and updating objects to the main list of objects, whereas the inventoryUI class handles implementation for the on screen HUD that tracks what is inside of the inventory. This involved a lot of changing past code, including many handle inputs so that the inventory objects could be read from. The knife is needed to be picked up in the first scene so that the rope can be cut.
5. The physics puzzle that we had in f1 is the same physics puzzle that we are using here, but with one crucial change. We utilized the new inventory system and knife object to chang our puzzle a bit. Now, the player needs to have the knife in their inventory to cut the rope, which adds another step to completing the puzzle.
6. This requirement is satisfied in the same way as in f1. The player succeeds by cutting the rope so the ball falls into the cup at the correct time. Failing is when the player cuts the ball at the incorrect time, and the ball misses the cup. This is done by skill, because the player needs to cut the ball at the right time, rather than just being able to cut randomly and hoping that it works.
7. The conclusing ending is reached when the player successfully gets the ball into the cup from the physics puzzle. When the player succeeds, text is shown on the screen that they have won, and that they have reached the end of the game.

## Reflection 2

Our thinking changed slightly from the start of F2 than when we finished. The main change was due to time. We needed to cut back on some implementation and ideas so that we could finish the project in a proper time. This involved cutting some extra rooms, and some more objects that the player could pick up. This also involved making the title screen in scene and engine, and it runs in a 3D environment, so we could only need to implement two scenes. This sprint for F2 was mainly reflected by having to cut down a lot of scope in order to complete the project in time, which was a helpful learning experience.
