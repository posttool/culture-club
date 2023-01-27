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
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

const LIMIT = 1000;

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

  async save() {
    if (this.docRef) {
      console.log("an update");
      var origData = this.docRef.data();
      var updateMap = {};
      for (var p in origData) {
        if (origData[p] != this[p]) {
          updateMap[p] = this[p];
        }
      }
      delete updateMap['created'];
      await updateDoc(doc(getFirestore(), this._db, this._id), updateMap);
      return this;
    } else {
      var map = { created: serverTimestamp() };
      DataObject.copyProps(this, map);
      this.docRef = await addDoc(collection(getFirestore(), this._db), map);
      this.created = this.docRef.created; //TODO verify
      this._id = this.docRef.id;
      return this.docRef;
    }
  }

  async get(id) {
    if (id.indexOf(this._db) == 0)
      id = id.substring(this._db.length + 1);
    this._id = this.id = id; // maybe choose the one without the underscore :)
    const docRef = doc(getFirestore(), this._db, this._id);
    try {
      this.docRef = await getDoc(docRef);
      if (this.docRef.exists()) {
        var d = this.docRef.data();
        DataObject.copyProps(d, this);
        return d;
      } else {
        console.log("Document does not exist");
        return null;
      }
    } catch (error) {
      console.log(error)
      return null;
    }
  }

  all(changeHandler) {
    var self = this;
    const c = collection(getFirestore(), self._db);
    const q = query(c, orderBy('created', 'asc'), limit(LIMIT));
    if (changeHandler) {
      // let unsubscribe =
      onSnapshot(q,
        function (snapshot) {
          // console.log('ALL '+self._db+' snapshot / ');
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

  some(w1, w2, w3, changeHandler) {
    var self = this;
    const c = collection(getFirestore(), self._db);
    const q = query(c, where(w1, w2, w3), orderBy('created', 'asc'), limit(LIMIT));
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


export class Culture extends DataObject {
  constructor(member, name, description, image) {
    super('culture');
    this.member = member;
    this.name = name;
    this.description = description;
    this.image = image;
  }

}

//static current
//static cached
export class Member extends DataObject {
  constructor(user) {
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
