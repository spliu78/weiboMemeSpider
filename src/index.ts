import nodeSchedule from 'node-schedule';
setInterval(() => {
    console.log(`INTERVAL`);
}, 3000);
nodeSchedule.scheduleJob('* * * *', () => {
    console.log(`time's up`);
});