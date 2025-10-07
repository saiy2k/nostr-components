export interface Post {
  name: string;
  noteid: string;
  hex: string;
  eventid: string;
}

export interface InputType {
  type: 'noteid' | 'hex' | 'eventid';
  value: string;
  name: string;
}

export const POST_DATA: Record<string, Post> = {
  gigi_free_web: {
    name: 'Gigi - Free web',
    noteid: 'note1kmf8n3c8fxfm3q26ys6vgrg306w05yrddt3txd4jtln47tunhscqp09muz',
    hex: '',
    eventid: '',
  },
  utxo_us_dollar_backing: {
    name: 'UTXO - US Dollar Backing',
    noteid: 'note13qzmyaseurn0n7tlfvax62ymdssac55ls99qu6053l0e2mtsy9nqp8c4nc',
    hex: '',
    eventid: '',
  },
  nvk_future_here: {
    name: 'NVK - Future here',
    noteid: '',
    hex: 'e6828f05e5279c5346652033c588c5081383bdd16c171be8d1daa947c2aeac8b',
    eventid: '',
  },
  ben_expensive_government: {
    name: 'Ben - Expensive Government',
    noteid: '',
    hex: '36aaf0468b0ed19e88c9245aafd6c1406d43c49866b88984b04686abf1d22ecb',
    eventid: '',
  },
  gigi_sysmiosis_system: {
    name: 'Gigi - Sysmiosis System',
    noteid: '',
    hex: '',
    eventid: 'nevent1qqstyhryvag0zukl62zw986zd23td45ya0fl8jtfu29uvpqry6jwj3c76k2cu',
  },
  calle_build_fools: {
    name: 'Calle - Build Fools',
    noteid: '',
    hex: '',
    eventid: 'nevent1qvzqqqqqqyqzp9nw89fvypc5nvkeu0gjd6tnex25gyc9d7j4cax7m8klr63tvk30unyylr',
  },
  jack_video_programming_you: {
    name: 'Jack - Video - Programming You',
    noteid: 'note1yllq2uug0assud0g928rm3g03dadnjlmrtvt9kpag6l3c3hn3pushusz7u',
    hex: '',
    eventid: '',
  },
  utxo_bitcoin_threat_govt: {
    name: 'UTXO - Bitcoin Threat Govt',
    noteid: 'note1xpfjezay98v5x6tptkn5wkckyyjwv3ar0zu2x5kmpq55d3c2kz7qz0f7hl',
    hex: '',
    eventid: '',
  },
  toxic_bitcoiner_image_state_exists: {
    name: 'Toxic Bitcoiner - Image - State Exists',
    noteid: 'note1tc9d0ad7039a8nhcdrzmp6ey09q2hmtz7eujm6jtt8htzu8geewq0epnwa',
    hex: '',
    eventid: '',
  },
  jack_rough_consensus: {
    name: 'Jack - Rough Consensus',
    noteid: 'note10q9f33dyh9cvsarfuyz32nr6u43smzregechp7w3efgjfs33nmusstjgtn',
    hex: '',
    eventid: '',
  },
};

export const getRandomProfile = (): Post => {
  const profiles = Object.values(POST_DATA);
  return profiles[Math.floor(Math.random() * profiles.length)];
};

export const getProfilesByType = (type: 'hex' | 'noteid' | 'eventid'): InputType[] => {
  return Object.values(POST_DATA)
    .filter(post => Boolean(post[type]))
    .map(post => ({
      type,
      value: post[type],
      name: post.name,
    }));
};

export const getAllInputTypes = (): InputType[] => {
  const profiles = Object.values(POST_DATA);
  const inputs: InputType[] = [];
  
  profiles.forEach(post => {
    if (post.hex) {
      inputs.push({ type: 'hex', value: post.hex, name: post.name });
    }
    if (post.noteid) {
      inputs.push({ type: 'noteid', value: post.noteid, name: post.name });
    }
    if (post.eventid) {
      inputs.push({ type: 'eventid', value: post.eventid, name: post.name });
    }
  });
  
  return inputs;
};
