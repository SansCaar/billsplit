import json,glob
def v(x): return x.get('value') if isinstance(x,dict) else x
for f in sorted(glob.glob('proof/raw/order-*.initialData.json')):
  try: o=json.load(open(f))['data']['order']
  except Exception as e: print(f, 'ERR', open(f).read()[:200]); continue
  pd=o['priceDetails']
  print('==',o['id'],o['orderDate'][:10],'G',len(o['groups_2101']),'sub',v(pd['subTotal']),'tax',v(pd['taxTotal']),'tot',v(pd['grandTotal']),'tip',v(pd['driverTip']),'fees',[(x['label'],x['value']) for x in pd['fees']],'disc',[(x.get('label'),x.get('value')) for x in pd['discounts']],'refund',json.dumps(pd.get('refund'))[:200] if pd.get('refund') else None)
  print('   pay',[(p['title'],p['description'],p['displayValues']) for p in o['paymentMethods']])
  for g in o['groups_2101']:
    tot=sum(i['priceInfo']['linePrice']['value'] for i in g['items'] if i.get('priceInfo') and i['priceInfo'].get('linePrice'))
    print('   G',g['fulfillmentType'],g.get('detailedGroupType'),'lines',len(g['items']),'sum',round(tot,2),'cats',[(c['type'],c['name']) for c in g.get('categories') or []],'gsub',v(g.get('subtotal')), 'seller', (g.get('seller') or {}).get('name'))
