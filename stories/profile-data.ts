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
  sai: {
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
