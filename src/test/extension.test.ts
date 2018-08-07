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
import { InamedElements } from '../elementXref';


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

suite('jsDoc formatting', function () {
    let pt = new PT.PolymerTsProps();
    pt.tabValue = '  ';
    test('format jsdoc', function () {
        const test1 =
            `   /**
         * bla bla
           * @polyProp { notify: true }
      */`;
        const test1ShouldBe = (
            `    /**
     * bla bla
     * @polyProp { notify: true }
     */
`
        ).replace(/\r/g, '').replace(/\n/g, pt.lineEnding);
        assert.equal(test1ShouldBe, pt._formatJsDoc(test1, 2));
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
        assert.equal(5, tsprops.length);
    });
    test('extracts polyProp from TS in // comment', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildTsToPolyist(tsprops, pprops, sample1);
        assert.equal(5, bld.length);
        assert.equal('() => { return []; }', bld[2].value);
        assert.equal('true', bld[2].notify);
    });
    test('extracts polyProp from TS in jsDoc comment', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildTsToPolyist(tsprops, pprops, sample1);
        assert.equal(5, bld.length);
        assert.equal('{}', bld[4].value);
        assert.equal('true', bld[4].notify);
        const p = bld[4];
        assert.equal('@polyProp {notify:true, value: {}}', p && p.jsDoc ? p.jsDoc.polyPropTag : '');
        assert.equal('{notify:true, value: {}}', p && p.jsDoc ? p.jsDoc.polyPropValue : '');
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
        assert.equal('Icomment[]', cfp && cfp.jsDoc ? cfp.jsDoc.typeValue : null);
    });
    test('removes type tag from target jsdoc in poly->ts', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildPolyToTsList(pprops, tsprops);
        const cfp = bld.find((b) => { return b.name === "_commentsForPost"; });
        assert.equal(false, cfp && cfp.jsDoc ? cfp.jsDoc.targetComment.includes('@type') || cfp.jsDoc.targetComment.includes('Icomment') : 'why null??');
    });
    test('removes polyProp tag from target jsdoc in ts->poly', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildTsToPolyist(tsprops, pprops, sample1);
        const ssp = bld.find((b) => { return b.name === "somewhatSpecial"; });
        assert.equal(true, (!ssp || !ssp.jsDoc) ? false : ssp.jsDoc.sourceComment.includes('* @polyProp {'));
        assert.equal(false, ssp && ssp.jsDoc ? ssp.jsDoc.targetComment.includes('@polyProp') || ssp.jsDoc.targetComment.includes('notify:true, value: {}') : 'why null??');
    });
    test('detects polymer extended declaration items', function () {
        const pprops = pt._getPolymerProperties(<ts.Node>ppn);
        const tsprops = pt._getTsPolyProps(ast);
        const bld = pt._buildPolyToTsList(pprops, tsprops);
        const cfp = bld.find((b) => { return b.name === "_commentsForPost"; });
        assert.equal("true", cfp ? cfp.notify : "-");
        assert.equal('"_commentsChanged"', cfp ? cfp.observer : "-");
        assert.equal("() => { return []; }", cfp ? cfp.value : "-");
    });
});
suite('Property Matching', function () {
    let pt = new PT.PolymerTsProps();
    let ast = ts.createSourceFile('sample.ts', sample1, ts.ScriptTarget.Latest, true);
    const ppn = pt._getPolymerPropsNode(ast);
    const pprops = pt._getPolymerProperties(<ts.Node>ppn);
    const tsprops = pt._getTsPolyProps(ast);
    test('Matches existing TS props to incoming polymer props', function () {
        const bld = pt._buildPolyToTsList(pprops, tsprops);
        let b = bld.find((bi) => { return bi.name === "author_email"; });
        assert.equal(true, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(false, b ? b.isNew : true);
        b = bld.find((bi) => { return bi.name === "postId"; });
        assert.equal(true, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(false, b ? b.isNew : true);
        b = bld.find((bi) => { return bi.name === "_commentsForPost"; });
        assert.equal(true, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(false, b ? b.isNew : true);
    });
    test('Does not matche TS props to new incoming polymer props', function () {
        const bld = pt._buildPolyToTsList(pprops, tsprops);
        let b = bld.find((bi) => { return bi.name === "comment_text"; });
        assert.equal(false, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(true, b ? b.isNew : false);
        b = bld.find((bi) => { return bi.name === "_errorMessage"; });
        assert.equal(false, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(true, b ? b.isNew : false);
        b = bld.find((bi) => { return bi.name === "_successMessage"; });
        assert.equal(false, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(true, b ? b.isNew : false);
    });
    test('Matches existing Polymer properties to incomning TS properties', function () {
        const bld = pt._buildTsToPolyist(tsprops, pprops, sample1);
        let b = bld.find((bi) => { return bi.name === "author_email"; });
        assert.equal(true, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(false, b ? b.isNew : true);
        b = bld.find((bi) => { return bi.name === "postId"; });
        assert.equal(true, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(false, b ? b.isNew : true);
        b = bld.find((bi) => { return bi.name === "_commentsForPost"; });
        assert.equal(true, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(false, b ? b.isNew : true);
    });
    test('Does not match polymer props to new incoming TS properties', function () {
        const bld = pt._buildTsToPolyist(tsprops, pprops, sample1);
        let b = bld.find((bi) => { return bi.name === "somewhatSpecial"; });
        assert.equal(false, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(true, b ? b.isNew : false);
        b = bld.find((bi) => { return bi.name === "verySpecial"; });
        assert.equal(false, b ? b.existingTargetDeclaration.start > 0 : false);
        assert.equal(true, b ? b.isNew : false);
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
        assert.equal('@polyProp', ppc);
        ppc = pt._generatePolyPropComment(bld[0]);
        assert.equal('@polyProp { value: 0, notify: true, observer: "_postIdObserver" }', ppc);
        ppc = pt._generatePolyPropComment(bld[7]);
        assert.equal('@polyProp { value: () => { return []; }, notify: true, observer: "_commentsChanged" }', ppc);
    });
    test('It generates TS prop strings', function () {
        const tsPropString = pt._generateTsPropDecs(bld);
        assert.equal(true, tsPropString.includes('_commentsForPost!: Icomment[]'));
        assert.equal(true, tsPropString.includes('// @polyProp { value: "", notify: true }'));
        assert.equal(true, tsPropString.includes('* @polyProp { value: () => { return []; }, notify: true, observer: "_commentsChanged" }'));
    });
});
suite("Polymer Property Generation", function () {
    let pt = new PT.PolymerTsProps();
    let ast = ts.createSourceFile('sample.ts', sample1, ts.ScriptTarget.Latest, true);
    const ppn = pt._getPolymerPropsNode(ast);
    const pprops = pt._getPolymerProperties(<ts.Node>ppn);
    const tsprops = pt._getTsPolyProps(ast);
    const bld = pt._buildTsToPolyist(tsprops, pprops, sample1);
    test('generates polymer properties string', function () {
        const ppstring: string = pt._generatePolymerPropDecs(bld);
        assert.equal(true, ppstring.includes('author_email: String,'));
        assert.equal(true, ppstring.includes('postId: Number,'));
        assert.equal(true, ppstring.includes('_commentsForPost: {'));
        assert.equal(true, ppstring.includes('@type {Icomment[]}'));
        assert.equal(true, ppstring.includes('value: () => { return []; },'));
        assert.equal(true, ppstring.includes('type: Array,'));
        assert.equal(true, ppstring.includes('type: Object,'));
    });
});
suite('$ Element Accessor', function () {
    let pt = new PT.PolymerTsProps();
    let ast = ts.createSourceFile('sample.ts', sample1, ts.ScriptTarget.Latest, true);
    test('Extracts elements with IDs from template', function () {
        const el = pt._buildElementList(ast);
        const f = function (key: string): InamedElements | undefined {
            return el.find(k => { return k.id === key; });
        };
        assert.equal(7, el.length);
        let e = f('postcomments');
        assert.equal('postcomments', e ? e.id : '');
        assert.equal('HTMLDivElement', e ? e.className : '');
        e = f('commenterEmail');
        assert.equal('commenterEmail', e ? e.id : '');
        assert.equal('HTMLElement', e ? e.className : '');
        assert.equal('paper-input', e ? e.tag : '');
    });
});