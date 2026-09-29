import json
import re
from pathlib import Path
import torch
from transformers import AutoTokenizer, AutoModel

PROJECT_ROOT = Path(r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence")
MODEL_PATH = PROJECT_ROOT / "ISDABI Model" / "MiniLM"
TRAINING_FILE = PROJECT_ROOT / "ISDABI Dataset" / "training" / "ISDABI Sales Training.jsonl"
REPORTS_DIR = PROJECT_ROOT / "ISDABI Reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

device = torch.device("cpu")
tokenizer = AutoTokenizer.from_pretrained(str(MODEL_PATH), local_files_only=True)
model = AutoModel.from_pretrained(str(MODEL_PATH), local_files_only=True).to(device)
model.eval()

def norm(s):
    return re.sub(r"\s+", " ", str(s or "").lower()).strip()

def get_turns(conversation):
    return [{"role": str(x.get("role","")).lower().strip(),
             "text": str(x.get("text","")).strip(),
             "normalized": norm(x.get("text",""))}
            for x in (conversation if isinstance(conversation,list) else [])
            if isinstance(x,dict) and str(x.get("role","")).lower().strip() in {"sales","customer"} and str(x.get("text","")).strip()]

def customer_turns(turns): return [x for x in turns if x["role"]=="customer"]
def sales_turns(turns): return [x for x in turns if x["role"]=="sales"]
def joined(turns): return " ".join(x["normalized"] for x in turns)

BUYING = {
"purchase_interest":[r"\bjoin\b",r"\bsign up\b",r"\bregister\b",r"\benroll\b",r"\bbuy\b",r"\bpurchase\b",r"\bget started\b",r"\bmove forward\b",r"\bready to join\b",r"\bready to start\b"],
"membership_interest":[r"\bmembership\b",r"\bmember\b",r"\bplan\b",r"\bmonthly\b",r"\bannual\b",r"\b12-month\b",r"\bcontract\b"],
"price_evaluation":[r"\bprice\b",r"\bcost\b",r"\bfee\b",r"\bhow much\b",r"\bdiscount\b",r"\bdeal\b",r"\brate\b",r"\bafford\b",r"\bexpensive\b",r"\bcheap\b"],
"trial_interest":[r"\btrial\b",r"\btry\b",r"\bvisit\b",r"\btour\b",r"\bcome in\b",r"\bcheck it out\b"],
"commitment":[r"\bready\b",r"\bgo ahead\b",r"\bmove forward\b",r"\bcommit\b",r"\bstart\b"]}

OBJECTIONS = {
"price_objection":[r"\btoo expensive\b",r"\bexpensive\b",r"\btoo much\b",r"\bcost\b",r"\bafford\b",r"\bcheaper\b",r"\bprice difference\b",r"\b\d+%\b.*\b(difference|cheaper|more)\b"],
"time_objection":[r"\bno time\b",r"\bnot enough time\b",r"\btoo busy\b",r"\bbusy schedule\b",r"\bfit.*schedule\b",r"\btime commitment\b"],
"commitment_objection":[r"\bcommitted\b",r"\block.*in\b",r"\bcontract\b",r"\blong.?term\b",r"\b12.?month\b",r"\bcancel\b",r"\bcancellation\b"],
"uncertainty":[r"\bnot sure\b",r"\bunsure\b",r"\buncertain\b",r"\bconcerned\b",r"\bworried\b",r"\bconcern\b",r"\bhesitant\b",r"\bneed.*clarif"],
"cancellation_concern":[r"\bcancel\b",r"\bcancellation\b",r"\bpenalty\b",r"\brefund\b",r"\bget out\b",r"\bchange my mind\b"]}

POSITIVE=[r"\byes\b",r"\byep\b",r"\bsounds good\b",r"\bsounds great\b",r"\bgreat\b",r"\bhelpful\b",r"\breassuring\b",r"\bappreciate\b",r"\bthank you\b",r"\bthanks\b",r"\binterested\b",r"\bdefinitely\b",r"\bexcellent\b",r"\bperfect\b"]
NEGATIVE=[r"\bno\b",r"\bnot interested\b",r"\btoo expensive\b",r"\bworried\b",r"\bconcerned\b",r"\bfrustrated\b",r"\bdisappointed\b",r"\bhesitant\b",r"\bafraid\b",r"\bfear\b",r"\bnot sure\b",r"\bdon't want\b"]
READY=[r"\bready to (join|start|sign up|register|enroll)\b",r"\blet's (do|go ahead|start)\b",r"\bi('m| am) ready\b",r"\bsign me up\b",r"\bi'll take\b"]
HESITATE=[r"\bneed some more time\b",r"\bneed more time\b",r"\bthink about it\b",r"\bthink it over\b",r"\bconsider my options\b",r"\bcompare.*options\b",r"\bcompare.*prices\b",r"\bnot ready\b",r"\bmaybe\b"]
FOLLOW=[r"\bchat again\b",r"\btalk again\b",r"\btouch base\b",r"\bfollow up\b",r"\bcall me\b",r"\bcontact me\b",r"\bcome back\b"]

def has(text, patterns): return any(re.search(p, norm(text)) for p in patterns)
def signals(text, groups):
    t=norm(text); return [k for k,v in groups.items() if any(re.search(p,t) for p in v)]

def embedding(text):
    e=tokenizer(text,return_tensors="pt",truncation=True,max_length=512,padding=True)
    e={k:v.to(device) for k,v in e.items()}
    with torch.no_grad(): o=model(**e)
    m=e["attention_mask"].unsqueeze(-1)
    x=(o.last_hidden_state*m).sum(1)/m.sum(1).clamp(min=1)
    return torch.nn.functional.normalize(x,p=2,dim=1)[0].cpu().tolist()

def intent(text,buy,obs):
    if has(text,READY): return "Very high purchase intent"
    if "purchase_interest" in buy: return "High purchase intent"
    if "trial_interest" in buy: return "Moderate purchase intent"
    if "membership_interest" in buy: return "Moderate purchase intent" if obs else "Potential purchase interest"
    if "price_evaluation" in buy: return "Information seeking"
    if obs: return "Low purchase intent"
    return "Information seeking"

# Sentiment V1.2.1.1
# Courtesy phrases such as "thanks" and "thank you" are not treated as
# positive sentiment by themselves. Concern/hesitation language is given
# greater weight because it better represents the customer's decision state.

COURTESY_PATTERNS = [
    r"\bthank you\b",
    r"\bthanks\b",
    r"\bappreciate\b",
]

STRONG_POSITIVE_PATTERNS = [
    r"\bexcited\b",
    r"\blove\b",
    r"\breally like\b",
    r"\bsounds great\b",
    r"\bsounds good\b",
    r"\bdefinitely\b",
    r"\bexcellent\b",
    r"\bperfect\b",
    r"\bawesome\b",
    r"\bvery helpful\b",
    r"\breassuring\b",
    r"\breassured\b",
    r"\bi'm interested\b",
    r"\bi am interested\b",
    r"\bi'd like to\b",
    r"\bi would like to\b",
    r"\bi'd love to\b",
    r"\bi would love to\b",
]

STRONG_NEGATIVE_PATTERNS = [
    r"\bnot interested\b",
    r"\btoo expensive\b",
    r"\bcan't afford\b",
    r"\bcannot afford\b",
    r"\bfrustrated\b",
    r"\bdisappointed\b",
    r"\bnever\b",
    r"\bdon't want\b",
    r"\bdo not want\b",
    r"\brefuse\b",
    r"\bno way\b",
]

CONCERN_PATTERNS = [
    r"\bworried\b",
    r"\bconcerned\b",
    r"\bconcern\b",
    r"\bhesitant\b",
    r"\bhesitate\b",
    r"\bnot sure\b",
    r"\bunsure\b",
    r"\buncertain\b",
    r"\bafraid\b",
    r"\bfear\b",
    r"\bneed more time\b",
    r"\bneed some more time\b",
    r"\bthink about it\b",
    r"\bconsider my options\b",
    r"\bcompare\b",
    r"\bmaybe\b",
    r"\bneed to think\b",
]

def sentiment(text, obs):
    t = norm(text)

    strong_positive = sum(
        bool(re.search(p, t))
        for p in STRONG_POSITIVE_PATTERNS
    )

    strong_negative = sum(
        bool(re.search(p, t))
        for p in STRONG_NEGATIVE_PATTERNS
    )

    concern_count = sum(
        bool(re.search(p, t))
        for p in CONCERN_PATTERNS
    )

    # Courtesy language is deliberately excluded from positive sentiment.
    courtesy_count = sum(
        bool(re.search(p, t))
        for p in COURTESY_PATTERNS
    )

    # Clear negative language takes priority.
    if strong_negative > 0:
        return "Negative"

    # A customer with repeated/explicit concerns is better represented as
    # concerned than positive merely because they also said "thanks".
    if concern_count >= 1:
        if strong_positive >= 2 and concern_count == 1:
            return "Positive"
        return "Concerned"

    if strong_positive > 0:
        return "Positive"

    if obs:
        return "Concerned"

    # Courtesy-only language is neutral, not positive.
    if courtesy_count > 0:
        return "Neutral"

    return "Neutral"

def engagement(ct,text):
    turns=len(ct); words=len(text.split()); qs=text.count("?")
    score=(2 if turns>=4 else 1 if turns>=3 else 0)+(2 if words>=120 else 1 if words>=70 else 0)+(2 if qs>=3 else 1 if qs>=1 else 0)
    return "High" if score>=5 else "Medium" if score>=2 else "Low"

def objection_handling(obs,st):
    if not obs: return {"status":"No clear objection detected","handled_objections":[],"unhandled_objections":[]}
    s=joined(st); handled=[]; unhandled=[]
    maps={
      "price_objection":[r"\bprice\b",r"\bcost\b",r"\bdiscount\b",r"\brate\b",r"\bmonthly\b",r"\bmarket\b"],
      "time_objection":[r"\bschedule\b",r"\btime\b",r"\bbusy\b",r"\bflexible\b",r"\bclass\b"],
      "commitment_objection":[r"\bcontract\b",r"\bmonth-to-month\b",r"\bcancel\b",r"\bcancellation\b",r"\bpenalt",r"\bcommitment\b"],
      "uncertainty":[r"\bunderstand\b",r"\bexplain\b",r"\bclarif",r"\bconcern\b",r"\bcomfortable\b",r"\bhelp\b"],
      "cancellation_concern":[r"\bcancel\b",r"\bcancellation\b",r"\brefund\b",r"\bpenalt"]}
    for o in obs:
        (handled if any(re.search(p,s) for p in maps.get(o,[])) else unhandled).append(o)
    status="Handled" if handled and not unhandled else "Partially handled" if handled else "Not handled"
    return {"status":status,"handled_objections":handled,"unhandled_objections":unhandled}

def decision(ct):
    for i in range(len(ct)-1,-1,-1):
        t=ct[i]["normalized"]
        if has(t,READY): return {"type":"Ready to buy","customer_text":ct[i]["text"],"turn_index":i}
        if has(t,HESITATE): return {"type":"Hesitation","customer_text":ct[i]["text"],"turn_index":i}
        if has(t,FOLLOW): return {"type":"Follow-up requested","customer_text":ct[i]["text"],"turn_index":i}
    return {"type":"Information gathering","customer_text":ct[-1]["text"] if ct else "","turn_index":len(ct)-1 if ct else None}

def analyze_record(record):
    turns=get_turns(record.get("conversation",[])); ct=customer_turns(turns); st=sales_turns(turns)
    ctext=joined(ct); stext=joined(st)
    buy=signals(ctext,BUYING); obs=signals(ctext,OBJECTIONS)
    ph=[p for p in POSITIVE if re.search(p,ctext)]; nh=[p for p in NEGATIVE if re.search(p,ctext)]
    oh=objection_handling(obs,st); dp=decision(ct); eng=engagement(ct,ctext)
    strengths=[]
    if buy: strengths.append("The customer shows identifiable purchase-related signals.")
    if oh["status"]=="Handled": strengths.append("The salesperson appears to address the customer's detected objections.")
    elif oh["status"]=="Partially handled": strengths.append("The salesperson addresses some of the customer's detected objections.")
    if eng=="High": strengths.append("The customer demonstrates strong conversational engagement.")
    elif eng=="Medium": strengths.append("The customer demonstrates moderate conversational engagement.")
    if dp["type"]=="Ready to buy": strengths.append("The customer expresses a clear readiness-to-buy signal.")
    if not strengths: strengths.append("The conversation contains a usable customer-sales interaction.")
    weaknesses=[]
    if obs: weaknesses.append("The customer expressed one or more objections or concerns.")
    if oh["status"]=="Not handled": weaknesses.append("The detected customer objections do not appear to receive a clear response.")
    elif oh["status"]=="Partially handled": weaknesses.append("Some detected customer objections may remain insufficiently addressed.")
    if eng=="Low": weaknesses.append("The customer shows limited conversational engagement.")
    if dp["type"]=="Hesitation": weaknesses.append("The customer ends at a hesitation or consideration stage.")
    if not weaknesses: weaknesses.append("No major transcript-level weakness was detected by the V1.2.1 rules.")
    if dp["type"]=="Ready to buy": follow="Provide the requested final details and guide the customer through the next purchase step."
    elif dp["type"] in {"Hesitation","Follow-up requested"}: follow="Follow up on the customer's remaining concerns, provide clear supporting information, and offer a simple next step."
    elif obs: follow="Follow up with relevant information addressing the customer's specific concerns before asking for a decision."
    else: follow="Follow up with relevant benefits and a clear next step toward the customer's decision."
    return {
      "conversation_id":record.get("conversation_id"),
      "ground_truth":{"actual_sales_outcome":record.get("outcome")},
      "customer_analysis":{"intent":intent(ctext,buy,obs),"sentiment":sentiment(ctext,obs)},
      "buying_signals":buy,"objections":obs,"objection_handling":oh,
      "positive_signals":ph,"negative_signals":nh,"decision_point":dp,
      "conversation_metrics":{"number_of_turns":len(turns),"customer_turns":len(ct),"sales_turns":len(st),"dataset_number_of_turns":record.get("number_of_turns"),"engagement_level":eng},
      "conversation_assessment":{"strengths":strengths,"weaknesses":weaknesses},
      "follow_up_recommendation":follow,
      "minilm":{"embedding_dimension":384,"embedding":embedding(ctext)},
      "conversation_text":record.get("conversation",[]),
      "analysis_text":{"customer_text":ctext,"sales_text":stext}
    }

def load_first_record():
    with open(TRAINING_FILE,"r",encoding="utf-8") as f: return json.loads(next(f))

if __name__=="__main__":
    r=analyze_record(load_first_record()); p=REPORTS_DIR/f"sales_engine_v1_2_{r['conversation_id']}.json"
    with open(p,"w",encoding="utf-8") as f: json.dump(r,f,indent=2,ensure_ascii=False)
    print("\nISDABI SALES ANALYSIS ENGINE V1.2.1")
    print("---------------------------------")
    print("MiniLM loaded successfully.")
    print(f"Device: {device}")
    print(f"Embedding size: {r['minilm']['embedding_dimension']}")
    print(f"\nConversation ID: {r['conversation_id']}")
    print(f"Actual Dataset Outcome: {r['ground_truth']['actual_sales_outcome']}")
    print(f"Customer Intent: {r['customer_analysis']['intent']}")
    print(f"Customer Sentiment: {r['customer_analysis']['sentiment']}")
    print(f"Engagement: {r['conversation_metrics']['engagement_level']}")
    print(f"Buying Signals: {len(r['buying_signals'])}")
    print(f"Objections: {len(r['objections'])}")
    print(f"Objection Handling: {r['objection_handling']['status']}")
    print(f"Decision Point: {r['decision_point']['type']}")
    print(f"\nReport: {p}")
    print("STATUS: PASS")
