const responseText = `\`\`\`json\n{ "why_it_matters": "The Minnesota judge threat of criminal contempt against ICE highlights a significant legal and political clash over imm...`;

const extractString = (key) => {
    const regex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?="\\s*,\\s*"[a-z_]+"\\s*:|"\\s*}|"$|$)`);
    const match = responseText.match(regex);
    return match ? match[1].replace(/\\"/g, '"').trim() : 'FAILED';
};

console.log(extractString('why_it_matters'));
