import { GameAgent } from "@virtuals-protocol/game";
import { createAgentWalletWorker } from '../workers/agent-wallet-worker';
import dotenv from 'dotenv';
import { Delegatee } from '@lit-protocol/agent-wallet';


dotenv.config();


// Function to initialize delegatee
async function initializeDelegatee() {
   const delegatee = await Delegatee.create(process.env.DELEGATEE_ADDRESS || "");
   return delegatee;
}


// Create a function that initializes the agent with a delegatee
export async function createAgentWalletAgent() {
   const delegatee = await initializeDelegatee();
   const worker = createAgentWalletWorker(delegatee);
  
   return new GameAgent(process.env.VIRTUALS_API_KEY || "", {
       name: "Agent Wallet Delegatee",
       goal: "Execute secure blockchain operations through Agent Wallet",
       description: `An AI delegatee that:
           - Interprets user intents and selects appropriate Agent Wallet tools
           - Executes transfers, swaps, and signing operations
           - Operates within defined security policies
           - Provides clear reasoning for each operation`,
       workers: [worker],
       getAgentState: async () => {
           return {
               network: "datil-dev",
               chainId: 175177,
               lastOperation: Date.now(),
               operationCount: 0,
               delegateeAddress: process.env.DELEGATEE_ADDRESS || ""
           };
       },
   });
}


// Function to run the agent
export async function runAgentWalletDelegatee() {
   try {
       // Create and initialize the agent
       const agent = await createAgentWalletAgent();
       await agent.init();
      
       // Set up custom logging
       agent.setLogger((msg) => {
           console.log(`[${agent.name}] ${msg}`);
       });


       // Start with a simple signing task to test the delegatee
       const tasks = [
           `Sign this message: "Hello from Agent Wallet"`,
       ];


       // Process each task
       for (const task of tasks) {
           console.log(`\nProcessing task: ${task}`);
           await agent.workers[0].runTask(task, { verbose: true });
       }


   } catch (error: any) {
       console.error("Error running Agent Wallet delegatee:", error.message);
   }
}


// Run if this file is executed directly
if (require.main === module) {
   runAgentWalletDelegatee();
}

