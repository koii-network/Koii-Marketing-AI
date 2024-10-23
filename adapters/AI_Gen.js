const { askllama } = require('./LLaMa/llama');
const { askCopilot } = require('./copilot/copilot');

async function filterNewLineChar(text){
    // remove /n
    console.log('text', text);
    const filteredText = text.replace(/\n/g, ' ');
    return filteredText;
  }

async function filterResponse(text){
    if (text.includes("off-limit") || text.includes("not able")|| text.includes("cannot")){
        return '';
    }
    const filteredText = text.replace(/"/g, '');
    return filteredText;
}
async function askBoth(question){
    let comment;
    try {
        const response = await askllama(question);
    if (response){
            comment = response;
        }   
    }catch(e){
        console.log('Error in askllama', e);
    }
    if (!comment){
        try{
            const filteredText = await filterNewLineChar(question);
            comment = await askCopilot(filteredText);
  
        }catch(e){
            console.log('Error in askCopilot', e);
        }
    }
    if (comment){
        const filteredComment = await filterResponse(comment);
        return filteredComment;
    }else{
        return '';
    }
}

module.exports = { askBoth };