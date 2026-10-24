// Urdu voice coach. Each English cue has: ur (Urdu script, for Urdu voices), hi (Devanagari, for Hindi
// voices, which pronounce the same spoken Hindustani), and roman (Roman Urdu captions).
const T = {
  'Red light ahead! Raise your right hand to stop.': ['آگے لال بتی ہے! رکنے کے لیے دایاں ہاتھ اوپر کریں۔', 'आगे लाल बत्ती है! रुकने के लिए दायां हाथ ऊपर करें।', 'Aage laal batti hai! Rukne ke liye daayan haath upar karein.'],
  'Signal is changing. Get ready to stop.': ['سگنل بدل رہا ہے۔ رکنے کے لیے تیار رہیں۔', 'सिग्नल बदल रहा है। रुकने के लिए तैयार रहें।', 'Signal badal raha hai. Rukne ke liye tayyar rahein.'],
  'Good stop. Wait for the green.': ['شاباش، اچھا رکے۔ ہری بتی کا انتظار کریں۔', 'शाबाश, अच्छा रुके। हरी बत्ती का इंतज़ार करें।', 'Shabash, achha ruke. Hari batti ka intezaar karein.'],
  'Green light. Off you go.': ['ہری بتی۔ اب چلیں۔', 'हरी बत्ती। अब चलें।', 'Hari batti. Ab chalein.'],
  'You ran a red light! Heavy penalty.': ['آپ نے لال بتی توڑ دی! بڑا جرمانہ۔', 'आपने लाल बत्ती तोड़ दी! बड़ा जुर्माना।', 'Aap ne laal batti tor di! Bara jurmana.'],
  'That was a yellow light. Slow down next time.': ['وہ پیلی بتی تھی۔ اگلی بار آہستہ ہوں۔', 'वो पीली बत्ती थी। अगली बार धीरे हों।', 'Woh peeli batti thi. Agli baar aahista hon.'],
  'Crash! Keep a safe distance.': ['ٹکر! محفوظ فاصلہ رکھیں۔', 'टक्कर! सुरक्षित फ़ासला रखें।', 'Takkar! Mehfooz faasla rakhein.'],
  'You hit a pedestrian! Always stop for people on the zebra crossing.': ['آپ نے پیدل چلنے والے کو ٹکر ماری! زیبرا کراسنگ پر ہمیشہ رکیں۔', 'आपने पैदल चलने वाले को टक्कर मारी! ज़ेबरा क्रॉसिंग पर हमेशा रुकें।', 'Aap ne paidal chalne wale ko takkar maari! Zebra crossing par hamesha rukein.'],
  'Too close! Back off.': ['بہت قریب! پیچھے رہیں۔', 'बहुत क़रीब! पीछे रहें।', 'Bohat qareeb! Peeche rahein.'],
  'Stay inside your lane.': ['اپنی لین میں رہیں۔', 'अपनी लेन में रहें।', 'Apni lane mein rahein.'],
  'No lane changes at the crossing.': ['کراسنگ پر لین نہ بدلیں۔', 'क्रॉसिंग पर लेन न बदलें।', 'Crossing par lane na badlein.'],
  'That was too close. Check your mirrors.': ['یہ بہت قریب تھا۔ شیشے دیکھیں۔', 'ये बहुत क़रीब था। शीशे देखें।', 'Yeh bohat qareeb tha. Sheeshe dekhein.'],
  'Stop weaving between lanes.': ['بار بار لین نہ بدلیں۔', 'बार बार लेन न बदलें।', 'Baar baar lane na badlein.'],
  'Use your indicator before changing lanes.': ['لین بدلنے سے پہلے انڈیکیٹر دیں۔', 'लेन बदलने से पहले इंडिकेटर दें।', 'Lane badalne se pehle indicator dein.'],
  'Hold the steering wheel with both hands to drive.': ['چلانے کے لیے دونوں ہاتھوں سے اسٹیئرنگ پکڑیں۔', 'चलाने के लिए दोनों हाथों से स्टीयरिंग पकड़ें।', 'Chalane ke liye dono haathon se steering pakrein.'],
  'Keep both hands up in front of you to control the speed.': ['رفتار کے لیے دونوں ہاتھ سامنے اوپر رکھیں۔', 'रफ़्तार के लिए दोनों हाथ सामने ऊपर रखें।', 'Raftaar ke liye dono haath saamne upar rakhein.'],
  'Go! Lean to steer, spread your hands to go faster, raise your right hand to stop.': ['چلیں! جھک کر اسٹیئرنگ کریں، ہاتھ دور کریں تو تیز، دایاں ہاتھ اوپر تو رکیں۔', 'चलें! झुक कर स्टीयरिंग करें, हाथ दूर करें तो तेज़, दायां हाथ ऊपर तो रुकें।', 'Chalein! Jhuk kar steering karein, haath door karein to tez, daayan haath upar to rukein.'],
  'Halfway there. Keep it civic.': ['آدھا راستہ طے ہو گیا۔ اسی طرح چلتے رہیں۔', 'आधा रास्ता तय हो गया। इसी तरह चलते रहें।', 'Aadha raasta tay ho gaya. Isi tarah chalte rahein.'],
  'Brake! Car stopped ahead.': ['بریک! آگے گاڑی رکی ہوئی ہے۔', 'ब्रेक! आगे गाड़ी रुकी हुई है।', 'Brake! Aage gaari ruki hui hai.'],
  'Ambulance behind you! Move to another lane and let it pass.': ['پیچھے ایمبولینس ہے! دوسری لین میں جائیں اور راستہ دیں۔', 'पीछे एम्बुलेंस है! दूसरी लेन में जाएं और रास्ता दें।', 'Peeche ambulance hai! Doosri lane mein jaayein aur raasta dein.'],
  'Wrong-way biker ahead in your lane! Move aside.': ['آگے الٹی طرف سے موٹر سائیکل آ رہی ہے! ایک طرف ہو جائیں۔', 'आगे उलटी तरफ़ से मोटरसाइकिल आ रही है! एक तरफ़ हो जाएं।', 'Aage ulti taraf se motorcycle aa rahi hai! Aik taraf ho jaayein.'],
  'Slow donkey cart ahead. Overtake carefully.': ['آگے گدھا گاڑی ہے۔ احتیاط سے آگے نکلیں۔', 'आगे गधा गाड़ी है। एहतियात से आगे निकलें।', 'Aage gadha gaari hai. Ehtiyaat se aage niklein.'],
  'You blocked the ambulance. Always make way.': ['آپ نے ایمبولینس کا راستہ روکا۔ ہمیشہ راستہ دیں۔', 'आपने एम्बुलेंस का रास्ता रोका। हमेशा रास्ता दें।', 'Aap ne ambulance ka raasta roka. Hamesha raasta dein.'],
  'Well done. You made way for the ambulance.': ['شاباش! آپ نے ایمبولینس کو راستہ دیا۔', 'शाबाश! आपने एम्बुलेंस को रास्ता दिया।', 'Shabash! Aap ne ambulance ko raasta diya.'],
  'Crash! Always watch for wrong-way riders.': ['ٹکر! الٹی طرف آنے والوں کا خیال رکھیں۔', 'टक्कर! उलटी तरफ़ आने वालों का ख़याल रखें।', 'Takkar! Ulti taraf aane walon ka khayal rakhein.'],
  'Eyes closed! Stay awake.': ['آنکھیں بند ہیں! جاگتے رہیں۔', 'आंखें बंद हैं! जागते रहें।', 'Aankhen band hain! Jaagte rahein.'],
  'You look sleepy. Focus on the road.': ['آپ کو نیند آ رہی ہے۔ سڑک پر دھیان دیں۔', 'आपको नींद आ रही है। सड़क पर ध्यान दें।', 'Aap ko neend aa rahi hai. Sarak par dhyan dein.'],
  'Yawning: you may be tired. Stay sharp.': ['جماہی آ رہی ہے، شاید آپ تھکے ہوئے ہیں۔ ہوشیار رہیں۔', 'जम्हाई आ रही है, शायद आप थके हुए हैं। होशियार रहें।', 'Jamaai aa rahi hai, shayad aap thake hue hain. Hoshiyar rahein.'],
  'Look at the road, not around.': ['ادھر ادھر نہیں، سڑک کو دیکھیں۔', 'इधर उधर नहीं, सड़क को देखें।', 'Idhar udhar nahin, sarak ko dekhein.'],
  'Eyes up! Are you on your phone?': ['نظریں اوپر! کیا آپ فون دیکھ رہے ہیں؟', 'नज़रें ऊपर! क्या आप फ़ोन देख रहे हैं?', 'Nazrein upar! Kya aap phone dekh rahe hain?'],
  "I can't see your face. Look at the road.": ['آپ کا چہرہ نظر نہیں آ رہا۔ سڑک کو دیکھیں۔', 'आपका चेहरा नज़र नहीं आ रहा। सड़क को देखें।', 'Aap ka chehra nazar nahin aa raha. Sarak ko dekhein.'],
  'Too many focus warnings. The game is paused until you are fully alert.': ['بہت زیادہ وارننگ۔ پوری طرح ہوشیار ہونے تک گیم رکی رہے گی۔', 'बहुत ज़्यादा वार्निंग। पूरी तरह होशियार होने तक गेम रुका रहेगा।', 'Bohat zyada warning. Poori tarah hoshiyar hone tak game ruki rahegi.'],
  'You are fully alert again. Resuming.': ['آپ پھر سے ہوشیار ہیں۔ گیم دوبارہ شروع۔', 'आप फिर से होशियार हैं। गेम दोबारा शुरू।', 'Aap phir se hoshiyar hain. Game dobara shuru.'],
  'Second chance. Your score is back to thirty. Drive carefully now.': ['دوسرا موقع۔ آپ کا اسکور تیس ہو گیا۔ اب احتیاط سے چلائیں۔', 'दूसरा मौक़ा। आपका स्कोर तीस हो गया। अब एहतियात से चलाएं।', 'Doosra mauqa. Aap ka score tees ho gaya. Ab ehtiyaat se chalayein.'],
  'The examiner has stopped the test.': ['ایگزامینر نے ٹیسٹ روک دیا۔', 'एग्ज़ामिनर ने टेस्ट रोक दिया।', 'Examiner ne test rok diya.'],
  'You reached the finish. Here is your civic driving score.': ['آپ منزل پر پہنچ گئے۔ یہ رہا آپ کا ڈرائیونگ اسکور۔', 'आप मंज़िल पर पहुंच गए। ये रहा आपका ड्राइविंग स्कोर।', 'Aap manzil par pohanch gaye. Yeh raha aap ka driving score.'],
  'Licence suspended. Too many violations.': ['لائسنس معطل۔ بہت زیادہ خلاف ورزیاں۔', 'लाइसेंस रद्द। बहुत ज़्यादा ग़लतियां।', 'Licence muattal. Bohat zyada khilaf warziyan.'],
  'Test failed. Let us look at what to improve.': ['ٹیسٹ پاس نہیں ہوا۔ آئیں دیکھیں کیا بہتر کرنا ہے۔', 'टेस्ट पास नहीं हुआ। आइए देखें क्या बेहतर करना है।', 'Test pass nahin hua. Aayein dekhein kya behtar karna hai.'],
  'Drive ended. Here is your score card.': ['ڈرائیو ختم۔ یہ رہا آپ کا اسکور کارڈ۔', 'ड्राइव ख़त्म। ये रहा आपका स्कोर कार्ड।', 'Drive khatam. Yeh raha aap ka score card.'],
  'Body lock lost. Game paused. Come back into the frame.': ['باڈی لاک ٹوٹ گیا۔ گیم رک گئی۔ کیمرے کے سامنے واپس آئیں۔', 'बॉडी लॉक टूट गया। गेम रुक गया। कैमरे के सामने वापस आएं।', 'Body lock toot gaya. Game ruk gayi. Camera ke saamne wapas aayein.'],
  'Body lock lost. Come back into the frame.': ['باڈی لاک ٹوٹ گیا۔ کیمرے کے سامنے واپس آئیں۔', 'बॉडी लॉक टूट गया। कैमरे के सामने वापस आएं।', 'Body lock toot gaya. Camera ke saamne wapas aayein.'],
  'Locked again. Resuming.': ['دوبارہ لاک ہو گیا۔ گیم شروع۔', 'दोबारा लॉक हो गया। गेम शुरू।', 'Dobara lock ho gaya. Game shuru.'],
  'Roads are wet. Brake early.': ['سڑکیں گیلی ہیں۔ جلدی بریک لگائیں۔', 'सड़कें गीली हैं। जल्दी ब्रेक लगाएं।', 'Sarkein geeli hain. Jaldi brake lagayein.'],
  'It is night. Watch for pedestrians.': ['رات ہے۔ پیدل چلنے والوں کا خیال رکھیں۔', 'रात है। पैदल चलने वालों का ख़याल रखें।', 'Raat hai. Paidal chalne walon ka khayal rakhein.'],
  'Thick fog. Slow down and look far ahead.': ['گہری دھند ہے۔ آہستہ چلیں اور دور تک دیکھیں۔', 'गहरी धुंध है। धीरे चलें और दूर तक देखें।', 'Gehri dhund hai. Aahista chalein aur door tak dekhein.'],
  'Go! Turn the wheel to steer, raise your right hand to brake.': ['چلیں! اسٹیئرنگ گھمائیں، بریک کے لیے دایاں ہاتھ اوپر کریں۔', 'चलें! स्टीयरिंग घुमाएं, ब्रेक के लिए दायां हाथ ऊपर करें।', 'Chalein! Steering ghumayein, brake ke liye daayan haath upar karein.'],
  'Well done! Starting the drive.': ['شاباش! ڈرائیو شروع۔', 'शाबाश! ड्राइव शुरू।', 'Shabash! Drive shuru.'],
  'Sit facing the camera with your head, shoulders and both hands in view.': ['کیمرے کی طرف منہ کر کے بیٹھیں۔ سر، کندھے اور دونوں ہاتھ نظر آئیں۔', 'कैमरे की तरफ़ मुंह करके बैठें। सिर, कंधे और दोनों हाथ नज़र आएं।', 'Camera ki taraf munh kar ke baithein. Sar, kandhe aur dono haath nazar aayein.'],
  'Fasten your seatbelt': ['سیٹ بیلٹ باندھیں', 'सीट बेल्ट बांधें', 'Seatbelt baandhein'],
  'Raise your right hand to brake': ['بریک کے لیے دایاں ہاتھ اوپر کریں', 'ब्रेक के लिए दायां हाथ ऊपर करें', 'Brake ke liye daayan haath upar karein'],
  'Turn the wheel left': ['اسٹیئرنگ بائیں گھمائیں', 'स्टीयरिंग बाएं घुमाएं', 'Steering baayein ghumayein'],
  'Turn the wheel right': ['اسٹیئرنگ دائیں گھمائیں', 'स्टीयरिंग दाएं घुमाएं', 'Steering daayein ghumayein'],
  'Lower the wheel to slow down': ['آہستہ کرنے کے لیے اسٹیئرنگ نیچے کریں', 'धीरे करने के लिए स्टीयरिंग नीचे करें', 'Aahista karne ke liye steering neeche karein'],
};

const ZONE_UR = { school: ['اسکول', 'स्कूल', 'School'], hospital: ['ہسپتال', 'अस्पताल', 'Hospital'] };

const PATTERNS = [
  [/^Slow down\. The limit is (\d+)\.$/, (m) => [`آہستہ کریں۔ رفتار کی حد ${m[1]} ہے۔`, `धीरे करें। रफ़्तार की हद ${m[1]} है।`, `Aahista karein. Raftaar ki hadd ${m[1]} hai.`]],
  [/^(\w+) zone\. Speed limit (\d+)\.$/i, (m) => {
    const z = ZONE_UR[m[1].toLowerCase()] || [m[1], m[1], m[1]];
    return [`${z[0]} زون۔ رفتار کی حد ${m[2]}۔`, `${z[1]} ज़ोन। रफ़्तार की हद ${m[2]}।`, `${z[2]} zone. Raftaar ki hadd ${m[2]}.`];
  }],
  [/^Level (\d+)\./, (m) => [`لیول ${m[1]} شروع۔ ہدایات اسکرین پر دیکھیں۔`, `लेवल ${m[1]} शुरू। हिदायात स्क्रीन पर देखें।`, `Level ${m[1]} shuru. Hidayaat screen par dekhein.`]],
  [/^Body locked\./, () => ['باڈی لاک ہو گیا۔ اب اگلا قدم کریں۔', 'बॉडी लॉक हो गया। अब अगला क़दम करें।', 'Body lock ho gaya. Ab agla qadam karein.']],
];

/** @returns {[ur, hi, roman] | null} */
export function translate(text) {
  if (T[text]) return T[text];
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return null;
}
