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

const LIMIT = 100;

class DataObject {

  constructor(dbName) {
    this._db = dbName;
    this._order = 'updated';
    this._direction = 'asc';
    this.created = null;
    this.updated = null;
    this.creator = null;
    this.state = 'private';
  }

  static copyProps(map1, map2) {
    for (var key in map1) {
      if (key.charAt(0) != '_' && map1[key] != null) {
        if (map1[key] instanceof DataObject) {
          map2[key] = map1[key].path()
        } else if (key == 'user') {
          map2[key] = map1[key].uid;
        } else {
          map2[key] = map1[key];
        }
      }
    }
  }

  path() {
    return this._db + '/' + this._id;
  }

  getCollectionRef() {
    return collection(getFirestore(), this._db);
  }

  getDocRef() {
    return doc(getFirestore(), this._db, this._id);
  }

  async save() {
    if (this.doc) {
      console.log("an update");
      // if (!this.doc.data) {
      this.doc = await getDoc(this.getDocRef());
      this._id = this.doc.id;
      // }
      var origData = this.doc.data();
      var updateMap = {};
      for (var p in origData) {
        if (!(this[p] instanceof DataObject) && origData[p] != this[p]) {
          updateMap[p] = this[p];
        }
      }
      delete updateMap['created'];
      if (Object.keys(updateMap).length != 0) {
        updateMap.updated = serverTimestamp();
      }
      await updateDoc(this.getDocRef(), updateMap);
      return this;
    } else {
      var map = { created: serverTimestamp(), updated: serverTimestamp(), creator: Member.current.uid };
      DataObject.copyProps(this, map);
      this.doc = await addDoc(this.getCollectionRef(), map);
      this.created = this.doc.created; //TODO verify
      this._id = this.doc.id;
      return this;
    }
  }

  async get(id) {
    if (id.indexOf(this._db) == 0)
      id = id.substring(this._db.length + 1);
    this._id = this.id = id; // maybe choose the one without the underscore :)
    this.doc = await getDoc(this.getDocRef());
    if (this.doc.exists()) {
      var d = this.doc.data();
      DataObject.copyProps(d, this);
      return d;
    } else {
      console.log("Document does not exist");
      return null;
    }
  }

  all(changeHandler) {
    return this._some(where('state', '==', 'public'), null, LIMIT, changeHandler);
  }

  some(w1, w2, w3, changeHandler) {
    return this.someLimit(w1, w2, w3, LIMIT, changeHandler)
  }

  someLimit(w1, w2, w3, l, changeHandler) {
    return this._some(where(w1, w2, w3), null, l, changeHandler)
  }

  _some(wo, wo2, l, changeHandler) {
    var self = this;
    const c = this.getCollectionRef();
    const o = orderBy(this._order, this._direction);
    const q = wo2 != null ?
      query(c, wo, wo2, o, limit(l)) :
      query(c, wo, o, limit(l));
    if (changeHandler) {
      // let unsubscribe =
      onSnapshot(q,
        function (snapshot) {
          // console.log('SOME '+self._db+' snapshot / ');
          snapshot.docChanges().forEach(function (change) {
            changeHandler(change);
          });
        }, function (e) {
          console.error('snapshot error ' + self._db);
          console.error(e);
        });
    }
    return q;
  }

}


// now the imporant stuff ...  the only representation of schema

export class Culture extends DataObject {
  constructor(member, name, description, image) {
    super('culture');
    this.member = member;
    this.name = name;
    this.description = description;
    this.image = image;
    this.introCount = 0;
    this.agentCount = 0;
  }

}

//static current
//static cached
export class Member extends DataObject {
  constructor(user) {
    super('member');
    if (user) {
      this.uid = user.uid;
      this.name = user.displayName;
      this.image = user.photoURL || '/images/profile_placeholder.png';
      this.state = 'public';
      // this.email = user.email;
    }
  }

  async checkExists() { // maybe should just make the path of this record member/uid ... instead of q
    var self = this;
    const q = self.some('uid', '==', self.uid);
    const qDocs = await getDocs(q);
    var found = false;
    qDocs.forEach((doc) => {
      DataObject.copyProps(doc.data(), self);
      self._id = doc.id;
      found = true;
    });
    if (!found) {
      await this.save();
    }
  }

}

export class Introduction extends DataObject {
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
    super('member'); // agent is a type of member
    this.culture = culture;  //indexed on culture
    this.member = member; // created by another member
    this.name = name;
    this.priming = priming;
    this.type = type;
    this.image = image;
  }
}


export class ServiceQueue extends DataObject {
  constructor() {
    super('service-queue');
    this.data;
    this.fname;
    this.state;
  }
}
