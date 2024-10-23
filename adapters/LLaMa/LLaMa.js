async function getEndpoints(){
    const endpoints = await fetch("https://vps-tasknet.koii.network/nodes/7ia22HzfZHPXh8kKwvcyEvHBEg1EaQvUJARUzejYbJQv")
    const endpointsList = (await endpoints.json()).map(node => node.data.url);
    console.log(endpointsList);
    return endpointsList;
}
async function askllama(question) {
    const endpoints = await getEndpoints();
    console.log(question);
    // shuffle the endpoints
    const shuffledEndpoints = endpoints.sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledEndpoints.length; i++) {
        const randomEndpoint = shuffledEndpoints[i];
        const accessLink = randomEndpoint + "/task/7ia22HzfZHPXh8kKwvcyEvHBEg1EaQvUJARUzejYbJQv";
        const response = await fetch(`${accessLink}/ask-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ model: "llama3.2", query: question }) 
          });
        try{
            const data = await response.json();
            const reply = data.reply;   
            console.log(reply);
            if (!reply) continue;
            return reply;
        } catch (error) {
            console.log(error);
        }
    }
}

module.exports = { askllama };
