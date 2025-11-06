import Joi from "joi"

// Schema construction
// const base = Joi.string();
// const withMin = base.min(5);

// console.log(base);
// console.log("================================");
// console.log(withMin);


// const userSchema = Joi.object({
//   username: Joi.string().required(),
// });

// const registeredSchema = userSchema.keys({
//   password: Joi.string().min(5).required()
// });

// const result1 = userSchema.validate({ username: "mena" });
// const result2 = registeredSchema.validate({ username: "maged" });

// console.log(result1.error ? result1.error.message : result1);
// console.error(result2.error ? result2.error.message : result2);

// Object Schema
// const schema = Joi.object({
//   a: Joi.string().required().allow("")
// });
// console.log(schema.validate({ a: "" }));


// Type Schema
// const schema3 = Joi.string().min(10);
// schema.validate("abcdefghij");


// const base = Joi.string().min(3);
// const specific = Joi.string().required();
// const merged = base.concat(specific);

// console.log(merged.validate(""))


// const schema = Joi.string().min(2).max(10);
// console.log(schema.validate('a').error.details);
function frozen(target: Function) {
  Object.freeze(target);
  Object.freeze(target.prototype);
}

// @frozen
class User {
  private static userType: string = "Generic";

  // @required
  private _email: string;

  // @required
  public username: string;

  public addressLine1: string = "";
  public addressLine2: string = "";
  public country: string = "";

  constructor(username: string, email: string) {
    this.username = username;
    this._email = email;
  }

  // @enumerable(false)
  get userType() {
    return User.userType;
  }

  get email() {
    return this._email;
  }

  set email(newEmail: string) {
    this._email = newEmail;
  }

  // @deprecated
  address(): any {
    return `${this.addressLine1}\n${this.addressLine2}\n${this.country}`;
  }
}

User.addNewProp = "Trying to add new prop value";


const p = new User("exampleUser", "example@example.com");
p.addressLine1 = "1, New Avenue";
p.addressLine2 = "Bahcelievler, Istanbul";
console.log(p)

