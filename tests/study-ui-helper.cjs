// Follow the visible navigation after the simpler home/menu design.
exports.openView=async(page,view)=>{
 const button=page.locator(`[data-view="${view}"]`);
 if(await button.isVisible()){await button.click();return;}
 if(view==='reader'){await page.locator('#btn-menu-reader').click();return;}
 throw Error('No visible navigation to '+view);
};
exports.openQuestionTools=async(page)=>{const tools=page.locator('#quiz-question-actions');if(!(await tools.evaluate(el=>el.open)))await tools.locator(':scope>summary').click();};
exports.openPersonalTools=async(page)=>{const tools=page.locator('#personal-question-panel');if(!(await tools.evaluate(el=>el.open)))await tools.locator(':scope>summary').click();};
