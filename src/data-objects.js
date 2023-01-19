import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  setDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

class DataObject {

  constructor(dbName) {
    this._db = dbName;
    this.created = null;
  }

  static copyProps(map1, map2) {
    for (var key in map1) {
      if (key.charAt(0) != '_' && map1[key] != null) {
        if (map1[key] instanceof DataObject) {
          map2[key] = map1[key].path()
        } else if (key == 'user') {
          map2[key] = map1[key].email;
        } else {
          map2[key] = map1[key];
        }
      }
    }
  }

  path() {
    return this._db + '/' + this._id;
  }

  async insert() {
    var map = {created: serverTimestamp()};
    DataObject.copyProps(this, map);
    try {
      const docRef = await addDoc(collection(getFirestore(), this._db), map);
      this.created = docRef.created; //TODO verify
      return docRef;
    }
    catch(error) {
      console.error('Error writing new '+this._db+' to database', error);
    }
  }

  async get(id) {
    this._id = id;
    const docRef = doc(getFirestore(), this._db, this._id);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        var d = docSnap.data();
        DataObject.copyProps(d, this);
        return d;
      } else {
        console.log("Document does not exist");
        return null;
      }
    } catch(error) {
      console.log(error)
      return null;
    }
  }

  all(changeHandler) {
    var self = this;
    const c = collection(getFirestore(), self._db);
    const q = query(c, orderBy('created', 'asc'), limit(20));
    if (changeHandler) {
      // let unsubscribe =
      onSnapshot(q,
        function(snapshot) {
          // console.log('ALL '+self._db+' snapshot / ');
          snapshot.docChanges().forEach(function(change) {
            changeHandler(change);
          });
        }, function(e){
          console.error('snapshot error '+self._db);
          console.error(e);
        });
    }
    return q;
  }

  some(w1, w2, w3, changeHandler) {
    var self = this;
    const c = collection(getFirestore(), self._db);
    const q = query(c, where(w1, w2, w3), orderBy('created', 'asc'), limit(20));
    if (changeHandler) {
      // let unsubscribe =
      onSnapshot(q,
        function(snapshot) {
          // console.log('SOME '+self._db+' snapshot / ');
          snapshot.docChanges().forEach(function(change) {
            changeHandler(change);
          });
        }, function(e){
          console.error('snapshot error '+self._db);
          console.error(e);
        });
    }
    return q;
  }

}


export class Culture extends DataObject {
  constructor(name, description, image, member){
    super('culture');
    this.name = name;
    this.description = description;
    this.image = image;
    this.member = member;
  }

}


//static current
//static cached
export class Member extends DataObject {
  constructor(user){
    super('member');
    this.user = user;
    if (user) {
      this.name = user.displayName;
      this.image = user.photoURL || '/images/profile_placeholder.png';
      this.email = user.email;
    }
  }
  async checkExists() {
    var self = this;
    const q = self.some('email', '==', self.user.email);
    const qDocs = await getDocs(q);
    var found = false;
    qDocs.forEach((doc) => {
      DataObject.copyProps(doc.data(), self);
      self._id = doc.id;
      found = true;
    });
    if (!found) {
      await this.insert();
    }
  }

    /*
    Name
    Image
    Created
    Last Visit
    Priming
    Priming History
    User (optional)
    Introductions
    Beliefs
    */

}

export class Introduction extends DataObject {
/*
Culture
Member
Text
Context
Flag
Date and Time
Response Candidates
  Member
  Text
  Context
  Adopters
  Flag
  Date and Time
*/
  constructor(culture, member, text, image) {
    super('introduction');
    this.culture = culture;
    this.member = member;
    this.text = text;
    this.image = image;
  }
}


export class Agent extends DataObject {
  constructor(culture, member, name, priming, type, image) {
    super('agent');
    this.culture = culture;
    this.member = member;
    this.name = name;
    this.priming = priming;
    this.type = type;
    this.image = image;
  }
}
