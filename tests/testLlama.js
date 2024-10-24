const { askllama } = require("../adapters/LLaMa/LLaMa");

require("dotenv").config();

async function testLlama(){
    console.log(process.env.DEV_MODE);
    const response = await askllama([{role: "user", content: "What is the capital of France?"}], {});
    console.log(response);
    const responseComment = await askForComment
}

testLlama();