import { tradingAgent } from '../src/agents/trading-agent';
import VirtualsAgentWallet from '../src/lit-agent-wallet';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    try {
        // 1. Initialize the Lit Agent Wallet
        const agentWallet = new VirtualsAgentWallet();
        await agentWallet.init();
        
        console.log("Lit Agent Wallet initialized");
        
        // 2. Initialize the Trading Agent
        await tradingAgent.init();
        console.log("Trading Agent initialized");
        
        // 3. Set up custom logging
        tradingAgent.setLogger((msg) => {
            console.log(`\n[${tradingAgent.name}]`);
            console.log(msg);
            console.log("----------------------------------------");
        });
        
        // 4. Start continuous monitoring and trading
        console.log("\nStarting automated trading...");
        
        // Run the agent every 5 minutes
        while (true) {
            try {
                // Check portfolio and market conditions
                await tradingAgent.step();
                
                // Wait 5 minutes before next analysis
                console.log("\nWaiting 5 minutes before next analysis...");
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
                
            } catch (error: any) {
                console.error("Error in trading loop:", error.message);
                // Wait 1 minute before retrying on error
                await new Promise(resolve => setTimeout(resolve, 60 * 1000));
            }
        }
        
    } catch (error: any) {
        console.error("Fatal error:", error.message);
        process.exit(1);
    }
}

main().catch(console.error); 