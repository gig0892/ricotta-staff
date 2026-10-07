import * as P from './payroll.js';
export function payrollWorkbook(X,report,settings,wages,t) {
 if(!report.ready)throw new Error('payroll_review_required');
 const wb=X.utils.book_new(),calcName='Calculation',summaryName=t('shSum'),{rows,range}=report;
 const calc=[['Staff key',t('staff'),t('date'),t('reg'),'Daily OT','Weekly OT',t('ot2'),'Holiday hours','Holiday weekly hours',t('stat2'),t('wage'),'Daily rate','Weekly rate','Double rate','Holiday rate','Holiday weekly rate',t('gross')]];
 for(const r of rows)for(const d of r.days){
  const n=calc.length+1,o=settings.ot;
  calc.push([r.staff.id,r.staff.name,d.date,d.reg,d.x15-(d.weekly||0),d.weekly||0,d.x2,d.stat-(d.statWeekly||0),d.statWeekly||0,d.stat2,
   P.wageOn(wages,r.staff.id,d.date),o.d1x,o.wx,o.d2x,settings.stat.x,Math.max(settings.stat.x,o.wx),
   {f:'K'+n+'*(D'+n+'+E'+n+'*L'+n+'+F'+n+'*M'+n+'+G'+n+'*N'+n+'+H'+n+'*O'+n+'+I'+n+'*P'+n+'+J'+n+'*N'+n+')',v:P.dayGross(d,P.wageOn(wages,r.staff.id,d.date),settings),t:'n'}]);
 }
 const first=6,last=first+rows.length-1,calcLast=Math.max(calc.length,2),vac=settings.vac?.on?settings.vac.pct/100:0;
 const summary=[
 ['Cafe Ricotta — '+summaryName],[t('period2'),range.start+' ~ '+range.end],
 ['America/Vancouver',P.TZDATA_VERSION],[t('xlsxHint')],
 [t('staff'),t('loc'),t('reg'),t('ot15'),t('ot2'),t('stat'),t('stat2'),t('wage'),t('gross'),t('statAvg'),t('vac'),t('tips'),t('total'),'','Staff key'],
 ...rows.map((r,i)=>{
  const n=first+i;
  return [r.staff.name,t(r.staff.loc),r.reg,r.x15,r.x2,r.stat,r.stat2,r.wage,
   {f:"ROUND(SUMIF('"+calcName+"'!$A$2:$A$"+calcLast+",O"+n+",'"+calcName+"'!$Q$2:$Q$"+calcLast+"),2)",v:r.gross,t:'n'},
   r.statAvgTotal,{f:'ROUND((I'+n+'+J'+n+')*'+vac+',2)',v:r.vac,t:'n'},r.tips,
   {f:'SUM(I'+n+':L'+n+')',v:r.total,t:'n'},r.wagesUsed.length>1?t('wageMixed'):'',r.staff.id];
 })
 ];
 if(rows.length)summary.push([t('total'),'',
  ...['C','D','E','F','G'].map(col=>({f:'SUM('+col+first+':'+col+last+')',t:'n'})),'',
  ...['I','J','K','L','M'].map(col=>({f:'SUM('+col+first+':'+col+last+')',t:'n'}))]);
 function sheet(data,widths){
  const ws=X.utils.aoa_to_sheet(data);ws['!cols']=widths.map(wch=>({wch}));
  for(const key of Object.keys(ws))if(!key.startsWith('!')&&ws[key].t==='n')ws[key].z='0.00';
  return ws;
 }
 const sum=sheet(summary,[20,12,12,14,14,18,22,14,14,18,14,12,18,46,38]);sum['!cols'][14].hidden=true;
 const detail=sheet(calc,[38,20,13,...Array(14).fill(22)]);detail['!cols'][0].hidden=true;
 X.utils.book_append_sheet(wb,sum,summaryName);X.utils.book_append_sheet(wb,detail,calcName);
 const shifts=[[t('staff'),t('date'),t('dowCol'),t('loc'),t('inT'),t('outT'),t('totalHours'),t('wage'),t('note')]];
 for(const r of rows)for(const d of r.days)for(const p of d.punches)shifts.push([r.staff.name,d.date,t('dow')[P.dow(d.date)],t(p.loc),P.local(p.inMs).hm,P.local(p.outMs).hm,P.shiftHours(p,settings),P.wageOn(wages,r.staff.id,d.date),p.note||'']);
 X.utils.book_append_sheet(wb,sheet(shifts,[20,14,10,14,12,12,16,16,36]),t('shDetail'));
 wb.Workbook={CalcPr:{calcId:191029,fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'}};
 return wb;
}
