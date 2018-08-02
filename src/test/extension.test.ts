//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as PT from '../extension';
import * as samples from './sampleCode';
// import * as vscode from 'vscode';
import * as ts from 'typescript';


// get code Samples
const sample1 = samples.sample1;

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together
suite("Testing Infrastructure", function () {

    // Defines a Mocha unit test
    test("Infrastructure Works", function () {
        assert.equal(-1, [1, 2, 3].indexOf(5));
        assert.equal(-1, [1, 2, 3].indexOf(0));
        test('sample data avail', function () {
            assert.equal(true, sample1.length > 100);
        });
        test('extension class avail', function () {
            let pt = new PT.PolymerTsProps();
            assert.equal('boolean', pt._PolymerTypeToTs('Boolean'));
        });
    });
});

suite("Property Detection", function () {
    let pt = new PT.PolymerTsProps();
    let ast = ts.createSourceFile('sample.ts', sample1, ts.ScriptTarget.Latest, true);
    const ppn = pt._getPolymerPropsNode(ast);

    test('gets polymer properties node', function () {
        assert.equal(true, !!ppn);
    });
    test('extracts polymer properties list', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        assert.equal(8, pprops.length);
    });
    test('extracts ts properties list', function () {
        const tsprops = pt._getTsPolyProps(ast);
        assert.equal(3, tsprops.length);
    });
    test('builds new property array poly->ts', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildPolyToTsList(pprops, tsprops);
        assert.equal(8, bld.length);
        const newCount = bld.filter((b) => { return b.isNew; }).length;
        assert.equal(5, newCount);
    });
    test('detects @type annotation', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildPolyToTsList(pprops, tsprops);
        const cfp = bld.find((b) => { return b.name === "_commentsForPost"; });
        assert.equal("Icomment[]", cfp ? cfp.tsType : "-");
    });
    test('detects polymer extended declaration items', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildPolyToTsList(pprops, tsprops);
        const cfp = bld.find((b) => { return b.name === "_commentsForPost"; });
        assert.equal("true", cfp ? cfp.notify : "-");
        assert.equal('"_commentsChanged"', cfp ? cfp.observer : "-");
        assert.equal("() => { return []; }", cfp ? cfp.value : "-")
    });
});
suite("TS property generation", function () {
    let pt = new PT.PolymerTsProps();
    let ast = ts.createSourceFile('sample.ts', sample1, ts.ScriptTarget.Latest, true);
    const ppn = pt._getPolymerPropsNode(ast);
    const pprops = pt._getPolymerProperties(<ts.Node>ppn);
    const tsprops = pt._getTsPolyProps(ast);
    const bld = pt._buildPolyToTsList(pprops, tsprops);
    test('Creates polyProp string', function () {
        let ppc = pt._generatePolyPropComment(bld[1]);
        assert.equal('// polyProp' + pt.lineEnding, ppc);
        ppc = pt._generatePolyPropComment(bld[0]);
        assert.equal('// polyProp { value: 0, notify: true, observer: "_postIdObserver" }' + pt.lineEnding, ppc);
    });
    test('It generates TS prop strings', function () {
        const tsPropString = pt._generateTsPropDecs(bld);
        assert.equal(true, tsPropString.includes('_commentsForPost!: Icomment[]'));
        assert.equal(true, tsPropString.includes('// polyProp { value: "", notify: true }'));
    });
});