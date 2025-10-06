export interface Profile {
  name: string;
  npub: string;
  nip05: string;
  pubkey: string;
}

export interface InputType {
  type: 'npub' | 'nip05' | 'pubkey';
  value: string;
  name: string;
}

export const PROFILE_DATA: Record<string, Profile> = {
  jack: {
    name: 'Jack',
    npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
    nip05: '',
    pubkey: '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2',
  },
  derGigi: {
    name: 'DerGigi',
    npub: 'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc',
    nip05: 'dergigi@primal.net',
    pubkey: '6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93',
  },
  fiatjaf: {
    name: 'Fiatjaf',
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6',
    nip05: 'fiatjaf@fiatjaf.com',
    pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  },
  jb55: {
    name: 'jb55',
    npub: 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s',
    nip05: 'jb55@jb55.com',
    pubkey: '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
  },
  odell: {
    name: 'Odell',
    npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx',
    nip05: 'odell@primal.net',
    pubkey: '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9',
  },
  lyn: {
    name: 'Lyn',
    npub: 'npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a',
    nip05: 'lyn@primal.net',
    pubkey: 'eab0e756d32b80bcd464f3d844b8040303075a13eabc3599a762c9ac7ab91f4f',
  },
  utxo: {
    name: 'Utxo the webmaster',
    npub: 'npub1utx00neqgqln72j22kej3ux7803c2k986henvvha4thuwfkper4s7r50e8',
    nip05: '',
    pubkey: 'e2ccf7cf20403f3f2a4a55b328f0de3be38558a7d5f33632fdaaefc726c1c8eb',
  },
  walker: {
    name: 'walker',
    npub: 'npub1cj8znuztfqkvq89pl8hceph0svvvqk0qay6nydgk9uyq7fhpfsgsqwrz4u',
    nip05: 'walker@primal.net',
    pubkey: '',
  },
  samson: {
    name: 'Samson Mow',
    npub: 'npub1excellx58e497gan6fcsdnseujkjm7ym5yp3m4rp0ud4j8ss39js2pn72a',
    nip05: 'excellion@jan3.com',
    pubkey: '',
  },
  karnage: {
    name: 'Karnage',
    npub: 'npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac',
    nip05: '',
    pubkey: '1bc70a0148b3f316da33fe3c89f23e3e71ac4ff998027ec712b905cd24f6a411',
  },
  adamback: {
    name: 'Adam Back',
    npub: 'npub1qg8j6gdwpxlntlxlkew7eu283wzx7hmj32esch42hntdpqdgrslqv024kw',
    nip05: '',
    pubkey: '020f2d21ae09bf35fcdfb65decf1478b846f5f728ab30c5eaabcd6d081a81c3e',
  },
  preston: {
    name: 'Preston',
    npub: 'npub1s5yq6wadwrxde4lhfs56gn64hwzuhnfa6r9mj476r5s4hkunzgzqrs6q7z',
    nip05: 'preston@primal.net',
    pubkey: '85080d3bad70ccdcd7f74c29a44f55bb85cbcd3dd0cbb957da1d215bdb931204',
  },
  jimmysong: {
    name: 'Jimmy song',
    npub: 'npub10vlhsqm4qar0g42p8g3plqyktmktd8hnprew45w638xzezgja95qapsp42',
    nip05: 'jimmysong@programmingbitcoin.com',
    pubkey: '7b3f7803750746f455413a221f80965eecb69ef308f2ead1da89cc2c8912e968',
  },
  guyswann: {
    name: 'Guy Swann',
    npub: 'npub1h8nk2346qezka5cpm8jjh3yl5j88pf4ly2ptu7s6uu55wcfqy0wq36rpev',
    nip05: 'theguyswann@iris.to',
    pubkey: 'b9e76546ba06456ed301d9e52bc49fa48e70a6bf2282be7a1ae72947612023dc',
  },
  ross: {
    name: 'Ross Ulbricht',
    npub: 'npub1pzzrdngrnlufqazx3lfj07k0vfuya6ehfy8q5yv2h8c5e8fxgmxqhxdsr8',
    nip05: 'ross@primal.net',
    pubkey: '',
  },
  snowden: {
    name: 'Edward Snowden',
    npub: 'npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9',
    nip05: 'Snowden@Nostr-Check.com',
    pubkey: '',
  },
  vitor: {
    name: 'Vitor Pamplona',
    npub: 'npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z',
    nip05: '',
    pubkey: '460c25e682fda7832b52d1f22d3d22b3176d972f60dcdc3212ed8c92ef85065c',
  },
  calle: {
    name: 'Calle',
    npub: 'npub12rv5lskctqxxs2c8rf2zlzc7xx3qpvzs3w4etgemauy9thegr43sf485vg',
    nip05: 'calle@cashu.me',
    pubkey: '',
  },
  saiy2k: {
    name: 'Saiyasodharan',
    npub: 'npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4svhsft3',
    nip05: 'saiy2k@.iris.to',
    pubkey: '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb',
  },
};

export const getRandomProfile = (): Profile => {
  const profiles = Object.values(PROFILE_DATA);
  return profiles[Math.floor(Math.random() * profiles.length)];
};

export const getProfilesByType = (type: 'npub' | 'nip05' | 'pubkey'): InputType[] => {
  return Object.values(PROFILE_DATA).map(profile => ({
    type,
    value: profile[type],
    name: profile.name,
  }));
};

export const getAllInputTypes = (): InputType[] => {
  const profiles = Object.values(PROFILE_DATA);
  const inputs: InputType[] = [];
  
  profiles.forEach(profile => {
    inputs.push(
      { type: 'npub', value: profile.npub, name: profile.name },
      { type: 'nip05', value: profile.nip05, name: profile.name },
      { type: 'pubkey', value: profile.pubkey, name: profile.name },
    );
  });
  
  return inputs;
};
