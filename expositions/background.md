
In the most fundamental form of the Haskell programming language, extracting one field's value from a record and creating a new record with the same field altered are two operations with very asymmetrical syntax.

```haskell
-- Define the "Person" record type
data Person = Person
  { name :: String
  , email :: String
  } deriving (Show)


demo :: [String]
demo =
  -- Expression to extract the "name" field from the Person "person"
  [ show (name person)
  -- Expression to create a copy of the Person "person" with a different name
  , show (person { name="Pauline Lewis" })
  ]
  -- Expression to construct a person
  where person = Person {
      name="Polly Lewis"
    , email="udki@usiasozo.az"
    }
```

The *lens* construct was created to remedy this issue, and this construct has broader application than just Haskell programs.  JavaScript — while a *very* different language than Haskell — runs into some of the same problems that led to lenses (as well as prisms, traversals, and other "optics") when *Plain Ol' Data* (POD) — often parsed from JSON — becomes involved: the data present carry no behaviors other than the standard ones for Array and Object.  Lenses allow us to build getter and setter logic from *outside* the POD, facilitating consistent reading and writing of our target data structure.

## Inspiration

Edward Kmett implemented the concept of "lenses" in Haskell as a method of navigating and manipulating nested data types.  The lenses exist separate from the data they access, unlike methods on JavaScript objects associated with class identity, which makes them ideal for accessing POD: POD just contains the data and does not encode behaviors (a.k.a. methods), and there are no guarantees about what indexes or properties are present as one descends into any particular POD value.

One of the key aspects of Kmett lenses is their formulation as a single Haskell function (the van Laarhoven formulation), which allows composition of lenses with the Haskell `.` (function composition) operator — though the order of application is reversed from what a Haskell programmer unfamiliar with lenses would expect, and looks like property access notation in JavaScript.  Unfortunately, unlike Haskell, JavaScript does not have a convenient way to compose functions.

Lenses that access and modify POD values have additional problems around partiality and polymorphic updates.  This tends to bring the Maybe monad into play via prisms.  So now we have lack of syntactically easy function composition and the presence of the Maybe monad that are interfering with a straightforward port of Kmett lenses to JavaScript for the purpose of digging into POD value.  While these obstacles can be overcome, and have been by other packages, the consequent syntax is awkward and very foreign to JavaScript.

This package attempts to put a more JavaScript-friendly face on lenses, building around the syntax and native data types supported by the language.
