/** @jsx hJSX */
import Cycle from '@cycle/core';
import { makeDOMDriver, hJSX } from '@cycle/dom';
import { makeHTTPDriver } from '@cycle/http';
import { flow, partial } from 'lodash';

const UPLOAD_URL = '/upload';

const Last = {
  None: n => f => s => n,
  Fail: msg => n => f => s => f(msg),
  Some: x => n => f => s => s(x)
};

function liftOption(opt) {
  return n => s => (opt == null) ? n() : s(opt);
}

function fileFromEvent(evt) {
  let file = evt.dataTransfer.files[0];

  return {
    name: file.name,
    maybeTimestamp: file.lastModifiedDate,
    contents: file
  };
}

function handleDragEvent(e) {
  e.stopPropagation();
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

function handleDragEventToFile(e) {
  handleDragEvent(e);
  return fileFromEvent(e);
}

function handleDragEventToUnit(e) {
  handleDragEvent(e);
  return null;
}

function intent(DOM) {
  return {
    dragEnter$: DOM.get('.drop-zone', 'dragenter').map(handleDragEventToUnit),
    dragLeave$: DOM.get('.drop-zone', 'dragleave').map(handleDragEventToUnit),
    drop$: DOM.get('.drop-zone', 'drop').map(handleDragEventToFile)
  };
}

function makeModification$(intent, uploads$) {
  let enter$ = intent.dragEnter$.map((file) => (state) => {
    console.log("start$", state);
    return { hasNewFile: true,
      maybeCurrentFile: state.maybeCurrentFile,
      lastFile: state.lastFile };
  });
  let leave$ = intent.dragLeave$.map((file) => (state) => {
    console.log("leave$", state);
    return { hasNewFile: false,
      maybeCurrentFile: state.maybeCurrentFile,
      lastFile: state.lastFile };
  });
  let drop$ = intent.drop$.map((file) => (state) => {
    console.log("drop$", state);
    return { hasNewFile: false,
      maybeCurrentFile: file,
      lastFile: state.lastFile };
  });
  let results$ = uploads$.switch().map((res) => (state) => {
    console.log("results$", state);
    return (res.ok) ?
      { hasNewFile: false,
        maybeCurrentFile: null,
        lastFile: Last.Some(state.maybeCurentFile) }
    :
      { hasNewFile: false,
        maybeCurrentFile: null,
        lastFile: Last.Fail(`upload failed with status: ${res.status}`) };
  });

  return Cycle.Rx.Observable.merge(
    enter$, leave$, drop$, results$
  );
}

function model(source, HTTP, intent) {
  let uploads$ = HTTP.filter(res$ => res$.request.url == UPLOAD_URL);

  let mod$ = makeModification$(intent, uploads$);

  let state$ = mod$.scan(source, (state, modify) => {
    return modify(state);
  });

  return {
    state$: state$.startWith(source),
    request$: intent.drop$.map((file) => {
      return { url: UPLOAD_URL,
        method: 'POST',
        send: { name: file.name } };
    })
  };
}

function viewModel(state$) {
  return state$.map((state) => {
    return {
      lastFileMsg: state.lastFile
        /* none */ (`You haven't uploaded anything yet`)
        /* fail */ (msg => `Upload failed with status ${msg}`)
        /* some */ (file => `Upload succeeded for file ${file}`),
      currStatus: liftOption(state.maybeCurrentFile)
          (() => `Waiting for file...`)
          (file => `Currently uploading ${file.name} with last modify ${file.maybeTimestamp}`),
      dropZoneText: (state.hasNewFile) ?
          `Drop here!` :
          `Drag-and-drop the file here`
    };
  });
}

function view(viewState$) {
  return viewState$.map(s =>
      <div>
        <h1>Drag and drop cycle</h1>
        <p>{s.lastFileMsg}</p>
        <p>{s.currStatus}</p>

        <div className='drop-zone'>{s.dropZoneText}</div>
      </div>
  );
}

// a file:
// { name, maybeTimestamp, contents: Blob }

const source = {
  hasNewFile: false,
  maybeCurrentFile: null,
  lastFile: Last.None
};

function main({ DOM, HTTP }) {
  let mi = flow(
      partial(intent, DOM),
      partial(model, source, HTTP)
  )();
  return {
    DOM: flow(
             partial(viewModel, mi.state$),
             view
         )(),
    HTTP: mi.request$
  };
}

let drivers = {
  DOM: makeDOMDriver('#app'),
  HTTP: makeHTTPDriver()
};

Cycle.run(main, drivers);

